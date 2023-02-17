const Script = require('../models/Script.js');
const User = require('../models/User');
const Notification = require('../models/Notification');
const _ = require('lodash');

// From https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
    let currentIndex = array.length,
        randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }

    return array;
}

/**
 * GET /
 * Get list of posts for feed
 */
exports.getScript = (req, res, next) => {
    var time_now = Date.now();
    var time_diff = time_now - req.user.createdAt; //in milliseconds, how long the user has existed since account creation

    var time_limit = time_diff - 86400000; //used later to show posts only in the past 24 hours

    User.findById(req.user.id)
        // .populate({
        //     path: 'posts.reply',
        //     model: 'Script',
        //     populate: {
        //         path: 'actor',
        //         model: 'Actor'
        //     }
        // })
        // .populate({
        //     path: 'posts.actorAuthor',
        //     model: 'Actor'
        // })
        .populate({
            path: 'posts.comments.actor',
            model: 'Actor'
        })
        .exec(function(err, user) {
            //User is no longer active - study is over
            if (!user.active) {
                req.logout();
                req.flash('errors', { msg: 'Account is no longer active. Study is over.' });
                res.redirect('/login');
            }

            user.logPage(Date.now(), "script"); //To do: Check if this works.

            //What day in the study are we in?
            var one_day = 86400000; // number of milliseconds in a day
            let current_day;

            //day one
            if (time_diff <= one_day) {
                current_day = 0;
                //add one to current day user.study_days[current_day]
                user.study_days.set(0, user.study_days[0] + 1);
            }
            //day two
            else if (time_diff <= (one_day * 2)) {
                current_day = 1;
                user.study_days.set(1, user.study_days[1] + 1);
            } else {
                console.log("Shouldn't be here.")
                current_day = -1;
            }

            //Get the newsfeed
            Script.find()
                .where('time').lte(time_diff).gte(time_limit)
                .sort('-time')
                .populate('actor')
                .populate({
                    path: 'comments.actor',
                    populate: {
                        path: 'actor',
                        model: 'Actor'
                    }
                })
                .exec(function(err, script_feed) {
                    if (err) { return next(err); }

                    //Final array of all posts to go in the feed
                    var finalfeed = [];

                    //Array of any user-made posts within the past 24 hours, 
                    //sorted by time they were created.
                    var user_posts = user.getPostInPeriod(time_limit, time_diff);
                    user_posts.sort(function(a, b) {
                        return b.relativeTime - a.relativeTime;
                    });

                    //Array of recent user-made posts, within the last 5 minutes. They will be appended to the top of the final feed.
                    var new_user_posts = [];

                    //While there are regular posts or user-made posts to add to the final feed
                    while (script_feed.length || user_posts.length) {
                        // If there are no more script_feed posts
                        // Or If user_post[0] post is more recent than script_feed[0] post
                        if (typeof script_feed[0] === 'undefined' ||
                            (!(typeof user_posts[0] === 'undefined') && (script_feed[0].time < user_posts[0].relativeTime))) {
                            //Look at the post in user_posts[0] now. 
                            user_posts[0].comments.sort(function(a, b) {
                                return a.relativeTime - b.relativeTime;
                            });
                            if ((Date.now() - user_posts[0].absTime) < 300000) {
                                //if post was made less than 5 minutes ago, it should be spliced into the TOP
                                new_user_posts.push(user_posts[0]);
                                user_posts.splice(0, 1);
                            } else {
                                //proceed normally
                                finalfeed.push(user_posts[0]);
                                user_posts.splice(0, 1);
                            }
                        } else {
                            //Looking at the post in script_feed[0] now.
                            //For this post, check if there is a user feedAction matching this post's ID and get its index.
                            var feedIndex = _.findIndex(user.feedAction, function(o) { return o.post == script_feed[0].id; });

                            if (feedIndex != -1) {
                                //User performed an action with this post
                                //Check to see if there are comment-type actions.
                                if (Array.isArray(user.feedAction[feedIndex].comments) && user.feedAction[feedIndex].comments) {
                                    //There are comment-type actions on this post.
                                    //For each comment on this post, add likes, flags, etc.
                                    for (const commentObject of user.feedAction[feedIndex].comments) {
                                        if (commentObject.new_comment) {
                                            // This is a new, user-made comment. Add it to the comments
                                            // list for this post.
                                            const cat = {
                                                commentID: commentObject.new_comment_id,
                                                body: commentObject.comment_body,
                                                time: commentObject.relativeTime,
                                                new_comment: commentObject.new_comment,
                                                likes: commentObject.likes,
                                                liked: commentObject.liked
                                            };
                                            script_feed[0].comments.push(cat);
                                        } else {
                                            // This is not a new, user-created comment.
                                            // Get the comment index that corresponds to the correct comment
                                            var commentIndex = _.findIndex(script_feed[0].comments, function(o) { return o.id == commentObject.comment; });
                                            // If this comment's ID is found in script_feed, add likes, flags, etc.
                                            if (commentIndex != -1) {
                                                // Check if there is a like recorded for this comment.
                                                if (commentObject.liked) {
                                                    // Update the comment in script_feed.
                                                    script_feed[0].comments[commentIndex].liked = true;
                                                    script_feed[0].comments[commentIndex].likes++;
                                                }
                                                // Check if there is a flag recorded for this comment.
                                                if (commentObject.flagged) {
                                                    // Remove the comment from the post if it has been flagged.
                                                    script_feed[0].comments.splice(commentIndex, 1);
                                                }
                                            }
                                        }
                                    }
                                }
                                script_feed[0].comments.sort(function(a, b) {
                                    return a.time - b.time;
                                });
                                // No longer looking at comments on this post.
                                // Now we are looking at the main post.
                                // Check if there user has viewed the post before.
                                if (user.feedAction[feedIndex].readTime[0]) {
                                    script_feed[0].read = true;
                                    script_feed[0].state = 'read';
                                } else {
                                    script_feed[0].read = false;
                                    script_feed[0].state = 'unread';
                                }

                                // Check if there is a like recorded for this post.
                                if (user.feedAction[feedIndex].liked) {
                                    script_feed[0].like = true;
                                    script_feed[0].likes++;
                                }

                                // Check if there is a reply recorded for this post.
                                if (user.feedAction[feedIndex].replyTime[0]) {
                                    script_feed[0].reply = true;
                                }

                                // Check if post has been flagged: remove it from feed array (script_feed)
                                if (user.feedAction[feedIndex].flagTime[0]) {
                                    script_feed.splice(0, 1);
                                } //Check if post is from a blocked user: remove it from feed array (script_feed)
                                else if (user.blocked.includes(script_feed[0].actor.username)) {
                                    script_feed.splice(0, 1);
                                } else {
                                    finalfeed.push(script_feed[0]);
                                    script_feed.splice(0, 1);
                                }
                            } //user did not interact with this post
                            else {
                                if (user.blocked.includes(script_feed[0].actor.username)) {
                                    script_feed.splice(0, 1);
                                } else {
                                    finalfeed.push(script_feed[0]);
                                    script_feed.splice(0, 1);
                                }
                            }
                        }
                    }

                    //shuffle up the list
                    // finalfeed = shuffle(finalfeed);

                    while (new_user_posts.length) {
                        finalfeed.splice(0, 0, new_user_posts[0]);
                        new_user_posts.splice(0, 1);
                    }

                    console.log("Script Size is now: " + finalfeed.length);
                    res.render('script', { script: finalfeed, showNewPostIcon: true });

                }); //end of Script.find()
        }); //end of User.findByID
}; //end of .getScript

/*
 * Post /post/new
 * Add new user post, including possible actor replies (comments) that go along with it.
 */
exports.newPost = (req, res) => {
    User.findById(req.user.id, (err, user) => {
        if (err) { return next(err); }

        //This is a new post
        if (req.file) {
            user.numPosts = user.numPosts + 1; //begins at 0
            const currTime = Date.now();

            var post = {
                type: "user_post",
                postID: user.numPosts,
                body: req.body.body,
                picture: req.file.filename,
                liked: false,
                likes: 0,
                comments: [],
                absTime: currTime,
                relativeTime: currTime - user.createdAt,
            };

            //Now we find any Actor Replies (Comments) that go along with it
            Notification.find()
                .where('userPost').equals(post.postID)
                .where('notificationType').equals('reply')
                .populate('actor')
                .exec(function(err, actor_replies) {
                    if (err) { return next(err); }
                    if (actor_replies.length > 0) {
                        //we have a actor reply that goes with this userPost
                        //add them to the posts array
                        for (const reply of actor_replies) {
                            user.numActorReplies = user.numActorReplies + 1; //begins at 0
                            var tmp_actor_reply = {
                                actor: reply.actor._id,
                                body: reply.replyBody,
                                commentID: user.numActorReplies,
                                relativeTime: post.relativeTime + reply.time,
                                absTime: new Date(user.createdAt.getTime() + post.relativeTime + reply.time),
                                new_comment: false,
                                likes: 0
                            };
                            post.comments.push(tmp_actor_reply);
                        }
                    }
                    user.posts.unshift(post); //adds elements to the beginning of the array
                    // user.logPostStats(post.postID); //To do: Check what this does.

                    user.save((err) => {
                        if (err) {
                            return next(err);
                        }
                        res.redirect('/');
                    });
                });
        } else {
            req.flash('errors', { msg: 'ERROR: Your post or reply did not get sent' });
            res.redirect('/');
        }
    });
};

/**
 * POST /feed/
 * Update user's actions on actor posts. 
 * All likes, flags, new comments (with actions on those comments as well) get added here.
 */
exports.postUpdateFeedAction = (req, res, next) => {
    User.findById(req.user.id, (err, user) => {
        if (err) { return next(err); }

        //find the object from the right post in feed
        var feedIndex = _.findIndex(user.feedAction, function(o) { return o.post == req.body.postID; });

        if (feedIndex == -1) {
            var cat = {
                post: req.body.postID,
                // postClass: 
                rereadTimes: 0,
                startTime: req.body.start || 0
            };
            // add new post into correct location
            feedIndex = user.feedAction.push(cat) - 1;
        }

        //create a new Comment
        if (req.body.new_comment) {
            user.numComments = user.numComments + 1;
            var cat = {
                new_comment: true,
                new_comment_id: user.numComments,
                comment_body: req.body.comment_text,
                relativeTime: req.body.new_comment - user.createdAt,
                absTime: req.body.new_comment,
                liked: false,
                flagged: false,
            }
            user.feedAction[feedIndex].comments.push(cat);
            user.feedAction[feedIndex].replyTime.push(cat.absTime);
        }

        //Are we doing anything with a comment?
        else if (req.body.commentID) {
            const isUserComment = (req.body.isUserComment == 'true');
            var commentIndex = (isUserComment) ?
                _.findIndex(user.feedAction[feedIndex].comments, function(o) {
                    return o.new_comment_id == req.body.commentID && o.new_comment == isUserComment
                }) :
                _.findIndex(user.feedAction[feedIndex].comments, function(o) {
                    return o.comment == req.body.commentID && o.new_comment == isUserComment
                });
            console.log(commentIndex)

            //no comment in this post-actions yet
            if (commentIndex == -1) {
                var cat = {
                    comment: req.body.commentID
                };
                user.feedAction[feedIndex].comments.push(cat);
                commentIndex = user.feedAction[feedIndex].comments.length - 1;
            }

            //LIKE A COMMENT
            if (req.body.like) {
                let like = req.body.like;
                if (user.feedAction[feedIndex].comments[commentIndex].likeTime) {
                    user.feedAction[feedIndex].comments[commentIndex].likeTime.push(like);

                } else {
                    user.feedAction[feedIndex].comments[commentIndex].likeTime = [like];
                }
                user.feedAction[feedIndex].comments[commentIndex].liked = true;
                if (req.body.isUserComment == 'true') user.feedAction[feedIndex].comments[commentIndex].likes++;
                if (req.body.isUserComment != 'true') user.numCommentLikes++;
            }

            //UNLIKE A COMMENT
            if (req.body.unlike) {
                let unlike = req.body.unlike;
                if (user.feedAction[feedIndex].comments[commentIndex].unlikeTime) {
                    user.feedAction[feedIndex].comments[commentIndex].unlikeTime.push(unlike);
                } else {
                    user.feedAction[feedIndex].comments[commentIndex].unlikeTime = [unlike];
                }
                user.feedAction[feedIndex].comments[commentIndex].liked = false;
                if (req.body.isUserComment == 'true') user.feedAction[feedIndex].comments[commentIndex].likes--;
                if (req.body.isUserComment != 'true') user.numCommentLikes--;
            }

            //FLAG A COMMENT
            else if (req.body.flag) {
                let flag = req.body.flag;
                if (user.feedAction[feedIndex].comments[commentIndex].flagTime) {
                    user.feedAction[feedIndex].comments[commentIndex].flagTime.push(flag);

                } else {
                    user.feedAction[feedIndex].comments[commentIndex].flagTime = [flag];
                }
                user.feedAction[feedIndex].comments[commentIndex].flagged = true;
            }
        }
        //Not a comment-- Are we doing anything with the post?
        else {
            //Flag event
            if (req.body.flag) {
                let flag = req.body.flag;
                if (!user.feedAction[feedIndex].flagTime) {
                    user.feedAction[feedIndex].flagTime = [flag];
                } else {
                    console.log("Should never be here.");
                    user.feedAction[feedIndex].flagTime.push(flag);
                }
            }

            //Like event
            else if (req.body.like) {
                let like = req.body.like;
                if (!user.feedAction[feedIndex].likeTime) {
                    user.feedAction[feedIndex].likeTime = [like];
                } else {
                    user.feedAction[feedIndex].likeTime.push(like);
                }
                user.feedAction[feedIndex].liked = true;
                user.numPostLikes++;
            }
            //Unlike event
            else if (req.body.unlike) {
                let unlike = req.body.unlike;
                if (!user.feedAction[feedIndex].unlikeTime) {
                    user.feedAction[feedIndex].unlikeTime = [like];
                } else {
                    user.feedAction[feedIndex].unlikeTime.push(unlike);
                }
                user.feedAction[feedIndex].liked = false;
                user.numPostLikes--;
            }

            //NEW VIEW TIME APPROACH POSTS
            //array of viewedTimes is empty and we have a new VIEW event
            // else if ((!user.feedAction[feedIndex].readTime) && req.body.viewed) {
            //     let viewedTime = req.body.viewed;
            //     user.feedAction[feedIndex].read = true;
            //     user.feedAction[feedIndex].readTime = [viewedTime];
            // }

            // //Already have a viewedTime Array, New VIEW event, need to add this to readTime array
            // else if ((user.feedAction[feedIndex].readTime) && req.body.viewed) {
            //     let viewedTime = req.body.viewed;
            //     //console.log("%%%%%Add new Read Time: ", read);
            //     user.feedAction[feedIndex].read = true;
            //     user.feedAction[feedIndex].readTime.push(viewedTime);
            // } else {
            //     console.log("Got a POST that did not fit anything. Possible Error.")
            // }
        }

        user.save((err) => {
            if (err) {
                if (err.code === 11000) {
                    req.flash('errors', { msg: 'Something in feedAction went crazy. You should never see this.' });
                    return res.redirect('/');
                }
                return next(err);
            }
            res.send({ result: "success" });
        });
    });
};

/**
 * POST /pro_feed/
 * Update user's profile feed posts Actions.
 getUserPostByID
 */
exports.postUpdateProFeedAction = (req, res, next) => {
    User.findById(req.user.id, (err, user) => {
        //somehow user does not exist here
        if (err) { return next(err); }

        console.log("@@@@@@@@@@@ TOP profile of PRO FEED  ", req.body.postID);

        //find the object from the right post in feed
        var feedIndex = _.findIndex(user.profile_feed, function(o) { return o.profile == req.body.postID; });

        console.log("index is  ", feedIndex);

        if (feedIndex == -1) {
            //Profile does not exist yet in User DB, so we have to add it now
            console.log("$$$$$Making new profile_feed Object! at post ", req.body.postID);
            var cat = new Object();
            cat.profile = req.body.postID;
            if (!(req.body.start)) {
                console.log("!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!No start");
            }
            cat.startTime = req.body.start;
            cat.rereadTimes = 0;
            //add new post into feedAction
            user.profile_feed.push(cat);

        } else {
            //we found the right post, and feedIndex is the right index for it
            //console.log("##### FOUND post "+req.body.postID+" at index "+ feedIndex);

            //update to new StartTime
            if (req.body.start && (req.body.start > user.profile_feed[feedIndex].startTime)) {

                user.profile_feed[feedIndex].startTime = req.body.start;
                user.profile_feed[feedIndex].rereadTimes++;

            }
            //OLD READ TIME APPROACH
            /*
                  //array of readTimes is empty and we have a new READ event
                  else if ((!user.profile_feed[feedIndex].readTime)&&req.body.read && (req.body.read > user.profile_feed[feedIndex].startTime))
                  {
                    let read = req.body.read - user.profile_feed[feedIndex].startTime
                    //console.log("!!!!!New FIRST READ Time: ", read);
                    user.profile_feed[feedIndex].readTime = [read];
                    //console.log("!!!!!adding FIRST READ time [0] now which is  ", user.feedAction[feedIndex].readTime[0]);
                  }


                  //Already have a readTime Array, New READ event, need to add this to readTime array
                  else if ((user.profile_feed[feedIndex].readTime)&&req.body.read && (req.body.read > user.profile_feed[feedIndex].startTime))
                  {
                    let read = req.body.read - user.profile_feed[feedIndex].startTime
                    //console.log("%%%%%Add new Read Time: ", read);
                    user.profile_feed[feedIndex].readTime.push(read);
                  }
            */

            //array of picture_clicks is empty and we have a new (first) picture_clicks event
            else if ((!user.profile_feed[feedIndex].picture_clicks) && req.body.picture && (req.body.picture > user.profile_feed[feedIndex].startTime)) {
                let picture = req.body.picture - user.profile_feed[feedIndex].startTime
                console.log("!!!!!New FIRST picture Time: ", picture);
                user.profile_feed[feedIndex].picture_clicks = [picture];
                console.log("!!!!!adding FIRST picture time [0] now which is  ", user.profile_feed[feedIndex].picture_clicks[0]);
            }

            //Already have a picture_clicks Array, New PICTURE event, need to add this to picture_clicks array
            else if ((user.profile_feed[feedIndex].picture_clicks) && req.body.picture && (req.body.picture > user.profile_feed[feedIndex].startTime)) {
                let picture = req.body.picture - user.profile_feed[feedIndex].startTime
                console.log("%%%%%Add new PICTURE Time: ", picture);
                user.profile_feed[feedIndex].picture_clicks.push(picture);
            }

            //NEW VIEW TIME APPROACH POSTS
            /*//array of viewedTimes is empty and we have a new VIEW event
            else if ((!user.profile_feed[feedIndex].viewedTime) && req.body.viewed)
            {
              let viewedTime = req.body.viewed;
              user.profile_feed[feedIndex].viewedTime = [viewedTime];
              console.log("@@@@@@@@added viewTime@@@@@@@");
            }

            //Already have a viewedTime Array, New VIEW event, need to add this to readTime array
            else if ((user.profile_feed[feedIndex].viewedTime)&&req.body.viewed)
            {
              let viewedTime = req.body.viewed;
              //console.log("%%%%%Add new Read Time: ", read);
              user.profile_feed[feedIndex].viewedTime.push(viewedTime);
              console.log("@@@@@@@@added viewTime@@@@@@@");
            }*/
            else {
                console.log("Got a POST that did not fit anything. Possible Error.")
            }



        } //else

        //console.log("@@@@@@@@@@@ ABOUT TO SAVE TO DB on Post ", req.body.postID);
        user.save((err) => {
            if (err) {
                if (err.code === 11000) {
                    req.flash('errors', { msg: 'Something in profile_feed went crazy. You should never see this.' });

                    return res.redirect('/');
                }
                console.log(err);
                return next(err);
            }
            //req.flash('success', { msg: 'Profile information has been updated.' });
            //res.redirect('/account');
            //console.log("@@@@@@@@@@@ SAVED TO DB!!!!!!!!! ");
            res.send({ result: "success" });
        });
    });
};

/**
 * POST /userPost_feed/
 * Update user's POST feed Actions: for User Posts
 */
exports.postUpdateUserPostFeedAction = (req, res, next) => {
    User.findById(req.user.id, (err, user) => {
        if (err) { return next(err); }

        //Find the index of object in user posts
        var feedIndex = _.findIndex(user.posts, function(o) { return o.postID == req.body.postID; });

        if (feedIndex == -1) {
            // Should not happen.
        } // Add a new comment
        else if (req.body.new_comment) {
            user.numComments = user.numComments + 1;
            var cat = {
                body: req.body.comment_text,
                commentID: user.numComments, // not sure if it needs to be added to 900
                relativeTime: req.body.new_comment - user.createdAt,
                absTime: req.body.new_comment,
                new_comment: true,
                liked: false,
                flagged: false,
                likes: 0
            };
            user.posts[feedIndex].comments.push(cat);
        } //Are we doing anything with a comment?
        else if (req.body.commentID) {
            var commentIndex = _.findIndex(user.posts[feedIndex].comments, function(o) {
                return o.commentID == req.body.commentID && o.new_comment == (req.body.isUserComment == 'true')
            });
            //no comment in this post-actions yet
            if (commentIndex == -1) {
                console.log("Should not happen.");
            }

            //LIKE A COMMENT
            else if (req.body.like) {
                user.posts[feedIndex].comments[commentIndex].liked = true;
                user.posts[feedIndex].comments[commentIndex].likes++;
            } else if (req.body.unlike) {
                user.posts[feedIndex].comments[commentIndex].liked = false;
                user.posts[feedIndex].comments[commentIndex].likes--;
            }

            //FLAG A COMMENT
            else if (req.body.flag) {
                user.posts[feedIndex].comments[commentIndex].flagged = true;
            }

        } //Not a comment-- Are we doing anything with the post?
        else {
            //we found the right post, and feedIndex is the right index for it
            if (req.body.like) {
                user.posts[feedIndex].liked = true;
                user.posts[feedIndex].likes++;
            }
            if (req.body.unlike) {
                user.posts[feedIndex].liked = false;
                user.posts[feedIndex].likes--;
            }
        }
        user.save((err) => {
            if (err) {
                if (err.code === 11000) {
                    req.flash('errors', { msg: 'Something in profile_feed went crazy. You should never see this.' });
                    return res.redirect('/');
                }
                console.log(err);
                return next(err);
            }
            res.send({ result: "success" });
        });
    });
}