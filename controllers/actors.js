const Actor = require('../models/Actor.js');
const Script = require('../models/Script.js');
const User = require('../models/User');
const _ = require('lodash');

/**
 * GET /actors
 * Get list of all actors
 */
exports.getActors = (req, res) => {
    Actor.find((err, docs) => {
        res.render('actors', { actors: docs });
    });
};

/**
 * GET /user/:userId
 * Get actor profile
 */
exports.getActor = (req, res, next) => {
    var time_diff = Date.now() - req.user.createdAt;

    User.findById(req.user.id).exec(function(err, user) {
        Actor.findOne({ username: req.params.userId }, async(err, act) => {
            if (err) { console.log(err); return next(err); }

            if (act == null) {
                var myerr = new Error('Actor Record not found!');
                return next(myerr);
            }

            const isBlocked = user.blocked.includes(req.params.userId);
            const isReported = user.reported.includes(req.params.userId);

            let script_feed = await Script.find({ actor: act.id })
                .where('time')
                .lte(time_diff)
                .sort('-time')
                .populate('actor')
                .populate({
                    path: 'comments.actor',
                    populate: {
                        path: 'actor',
                        model: 'Actor'
                    }
                })
                .exec();

            if (err) { console.log(err); return next(err); }
            for (var i = script_feed.length - 1; i >= 0; i--) {
                var feedIndex = _.findIndex(user.feedAction, function(o) { return o.post == script_feed[i].id; });

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
                                    body: commentObject.body,
                                    time: commentObject.relativeTime,
                                    new_comment: commentObject.new_comment,
                                    likes: commentObject.likes,
                                    liked: commentObject.liked
                                };
                                script_feed[i].comments.push(cat);
                            } else { // This is not a new, user-created comment.
                                // Get the comment index that corresponds to the correct comment
                                var commentIndex = _.findIndex(script_feed[i].comments, function(o) { return o.id == commentObject.comment; });
                                // If this comment's ID is found in script_feed, add likes, flags, etc.
                                if (commentIndex != -1) {
                                    // Check if there is a like recorded for this comment.
                                    if (commentObject.liked) {
                                        // Update the comment in script_feed.
                                        script_feed[i].comments[commentIndex].liked = true;
                                    }
                                    // Check if there is a flag recorded for this comment.
                                    if (commentObject.flagged) {
                                        // Remove the comment from the post if it has been flagged.
                                        script_feed[i].comments.splice(commentIndex, 1);
                                    }
                                }
                            }
                        }
                    }

                    script_feed[i].comments.sort(function(a, b) {
                        return a.time - b.time;
                    });
                    // No longer looking at comments on this post.
                    // Now we are looking at the main post.
                    // Check if there user has viewed the post before.
                    if (user.feedAction[feedIndex].readTime[0]) {
                        script_feed[i].read = true;
                        script_feed[i].state = 'read';
                    } else {
                        script_feed[i].read = false;
                        script_feed[i].state = 'unread';
                    }

                    // Check if there is a like recorded for this post.
                    if (user.feedAction[feedIndex].liked) {
                        script_feed[i].like = true;
                        script_feed[i].likes++;
                    }

                    // Check if post has been flagged: remove it from feed array (script_feed)
                    if (user.feedAction[feedIndex].flagTime[0]) {
                        script_feed.splice(i, 1);
                    }
                }
            }
            user.save((err) => {
                if (err) {
                    return next(err);
                }
            });
            res.render('actor', { script: script_feed, actor: act, isBlocked: isBlocked, isReported: isReported, title: act.profile.name });
        });
    });
};

/**
 * POST /user
 * Update block, report, follow actor list.
 */
exports.postBlockReportOrFollow = (req, res, next) => {
    User.findById(req.user.id, (err, user) => {
        //somehow user does not exist here
        if (err) { return next(err); }

        //Blocking a user: 
        //if we have a blocked user and they are not already in the list, add them now
        if (req.body.blocked) {
            if (!(user.blocked.includes(req.body.blocked))) {
                user.blocked.push(req.body.blocked)
            };
            var log = {
                time: Date.now(),
                action: "block",
                actorName: req.body.blocked,
            };
            user.blockReportAndFollowLog.push(log);
        }
        //Reporting a user:
        //if we have a reported user and they are not already in the list, add them now
        else if (req.body.reported) {
            if (!(user.reported.includes(req.body.reported))) {
                user.reported.push(req.body.reported);
            }
            var log = {
                time: Date.now(),
                action: "report",
                actorName: req.body.reported,
                report_issue: req.body.report_issue
            };
            user.blockReportAndFollowLog.push(log);
        }
        //Unblocking a user: 
        //if we have an unblocked user and they are already in the list
        else if (req.body.unblocked) {
            if (user.blocked.includes(req.body.unblocked)) {
                var index = user.blocked.indexOf(req.body.unblocked);
                user.blocked.splice(index, 1);
            }
            var log = {
                time: Date.now(),
                action: "unblock",
                actorName: req.body.unblocked,
            };
            user.blockReportAndFollowLog.push(log);
        } //Following a user: 
        else if (req.body.followed) {
            if (!(user.followed.includes(req.body.followed))) {
                user.followed.push(req.body.followed)
            };
            var log = {
                time: Date.now(),
                action: "follow",
                actorName: req.body.followed,
            };
            user.blockReportAndFollowLog.push(log);
        } //Unfollowing a user
        else if (req.body.unfollowed) {
            if (user.followed.includes(req.body.unfollowed)) {
                var index = user.followed.indexOf(req.body.unfollowed);
                user.followed.splice(index, 1);
            }
            var log = {
                time: Date.now(),
                action: "unfollow",
                actorName: req.body.unfollowed,
            };
            user.blockReportAndFollowLog.push(log);
        }

        user.save((err) => {
            if (err) {
                return next(err);
            }
            res.send({ result: "success" });
        });
    });
};