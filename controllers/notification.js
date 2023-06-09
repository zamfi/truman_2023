const Script = require('../models/Script.js');
const User = require('../models/User');
const Notification = require('../models/Notification.js');
const _ = require('lodash');

/**
 * GET /notifications, /getBell
 * List of notifications to display
 */
exports.getNotifications = async(req, res) => {
    if (req.user) {
        User.findById(req.user.id)
            .populate({
                path: 'posts.comments.actor',
                model: 'Actor'
            })
            .exec(function(err, user) {
                var userPosts = user.getPosts() || [];
                var actorPosts = []; //actorPosts with user comments on it
                let userReplies = {}; //Key: userReplyID, Value: the object given to script to render

                let repliesOnActorPosts = user.feedAction
                    .filter(post => (post.comments.filter(comment => comment.new_comment == true).length) > 0)
                    .map(post => post.post); // IDs of actor posts that have user comments on them.

                Script.find({
                        _id: { "$in": repliesOnActorPosts }
                    })
                    .populate('actor')
                    .populate({
                        path: 'comments.actor',
                        populate: {
                            path: 'actor',
                            model: 'Actor'
                        }
                    })
                    .exec(function(err, posts) {
                        for (const post of posts) {
                            let commentIDs = [];
                            var feedIndex = _.findIndex(user.feedAction, function(o) { return o.post == post.id; });
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
                                            post.comments.push(cat);
                                            commentIDs.push(cat.commentID);
                                        } else { // This is not a new, user-created comment.
                                            // Get the comment index that corresponds to the correct comment
                                            var commentIndex = _.findIndex(post.comments, function(o) { return o.id == commentObject.comment; });
                                            // If this comment's ID is found in script_feed, add likes, flags, etc.
                                            if (commentIndex != -1) {
                                                // Check if there is a like recorded for this comment.
                                                if (commentObject.liked) {
                                                    // Update the comment in script_feed.
                                                    post.comments[commentIndex].liked = true;
                                                }
                                                // Check if there is a flag recorded for this comment.
                                                if (commentObject.flagged) {
                                                    // Remove the comment from the post if it has been flagged.
                                                    post.comments.splice(commentIndex, 1);
                                                }
                                            }
                                        }
                                    }
                                }
                                post.comments.sort(function(a, b) {
                                    return a.time - b.time;
                                });
                                // No longer looking at comments on this post.
                                // Now we are looking at the main post.
                                // Check if there user has viewed the post before.
                                if (user.feedAction[feedIndex].readTime[0]) {
                                    post.read = true;
                                    post.state = 'read';
                                } else {
                                    post.read = false;
                                    post.state = 'unread';
                                }
                                // Check if there is a like recorded for this post.
                                if (user.feedAction[feedIndex].liked) {
                                    post.like = true;
                                    post.likes++;
                                }
                            }

                            for (const commentID of commentIDs) {
                                userReplies[commentID] = post;
                            }
                            actorPosts.push(post);
                        }

                        for (const post of user.posts) {
                            if (post.comments) {
                                if (post.comments.filter(comment => comment.new_comment == true).length == 0) {
                                    continue;
                                } else {
                                    post.comments.sort(function(a, b) {
                                        return a.relativeTime - b.relativeTime;
                                    });

                                    for (const commentObject of post.comments) {
                                        if (commentObject.new_comment) {
                                            userReplies[commentObject.commentID] = post;
                                        }
                                    }
                                }
                            }
                        };

                        //Log our visit to Notifications
                        const lastNotifyVisit = user.lastNotifyVisit; //Absolute Date.
                        if (!req.query.bell) {
                            user.lastNotifyVisit = Date.now();
                        }

                        Notification.find({ $or: [{ userPost: { $lte: user.numPosts } }, { userReply: { $lte: user.numComments } }] })
                            .populate('actor')
                            .sort('-time')
                            .exec(function(err, notification_feed) {
                                if (err) { return next(err); }

                                var final_notify = [];
                                for (const notification of notification_feed) {
                                    //Notification is about a userPost (read, like, comment)
                                    if (notification.userPost >= 0) {
                                        var userPostID = notification.userPost;
                                        var userPost = user.getUserPostByID(userPostID);

                                        var time_diff = Date.now() - userPost.absTime; //Time since userPost was made

                                        //check if we show this notification yet
                                        if (notification.time <= time_diff) {
                                            if (notification.notificationType == "reply") {
                                                var replyKey = "actorReply_" + userPostID;
                                                let reply_tmp = {
                                                    key: replyKey,
                                                    action: 'reply',
                                                    postID: userPostID,
                                                    body: userPost.body,
                                                    picture: userPost.picture,
                                                    replyBody: notification.replyBody,
                                                    time: userPost.absTime.getTime() + notification.time,
                                                    actor: notification.actor,
                                                    unreadNotification: userPost.absTime.getTime() + notification.time > lastNotifyVisit,
                                                };
                                                final_notify.push(reply_tmp);
                                            } //end of REPLY 
                                            else {
                                                const key = notification.notificationType + "_" + userPostID; //like_X, read_X
                                                let notifyIndex = _.findIndex(final_notify, function(o) { return o.key == key });
                                                if (notifyIndex == -1) {
                                                    let tmp = {
                                                        key: key,
                                                        action: notification.notificationType,
                                                        postID: userPostID,
                                                        body: userPost.body,
                                                        picture: userPost.picture,
                                                        time: userPost.absTime.getTime() + notification.time,
                                                        actors: [notification.actor],
                                                        unreadNotification: userPost.absTime.getTime() + notification.time > lastNotifyVisit
                                                    }
                                                    if (notification.notificationType == 'like') {
                                                        tmp.numLikes = 1
                                                    }
                                                    notifyIndex = final_notify.push(tmp) - 1;
                                                } else {
                                                    if (notification.notificationType == 'like') {
                                                        final_notify[notifyIndex].numLikes += 1;
                                                    }
                                                    //if generic-joe, append. else, shift to the front of the line.
                                                    if (notification.notificationType == "read" && notification.actor.username == "generic-joe") {
                                                        final_notify[notifyIndex].actors.push(notification.actor);
                                                    } else {
                                                        final_notify[notifyIndex].actors.unshift(notification.actor);
                                                    }
                                                    if ((userPost.absTime.getTime() + notification.time) > final_notify[notifyIndex].time) {
                                                        final_notify[notifyIndex].time = userPost.absTime.getTime() + notification.time;
                                                    }
                                                    if ((userPost.absTime.getTime() + notification.time) > lastNotifyVisit) {
                                                        final_notify[notifyIndex].unreadNotification = true;
                                                    }
                                                }
                                                if (notification.notificationType == 'like') {
                                                    let postIndex = _.findIndex(user.posts, function(o) { return o.postID == userPostID; });
                                                    user.posts[postIndex].likes = final_notify[notifyIndex].numLikes;
                                                }
                                            }
                                        }
                                    } //Notification is about a userReply (read, like)
                                    else if (notification.userReply >= 0) {
                                        var userReplyID = notification.userReply;
                                        var userReply_originalPost = userReplies[userReplyID]; //User or Actor; object passed to script

                                        const postType = userReply_originalPost.relativeTime ? "user" : "actor";
                                        const userPostID = (postType == "user") ? userReply_originalPost.postID : userReply_originalPost._id;
                                        const userReply_comment = userReply_originalPost.comments.find(comment => comment.commentID == userReplyID && comment.new_comment == true);

                                        const time = (postType == "user") ?
                                            userReply_comment.absTime.getTime() : user.createdAt.getTime() + userReply_comment.time;

                                        var time_diff = Date.now() - time; //Time since userReply was made
                                        //check if we show this notification yet
                                        if (notification.time <= time_diff) {
                                            const key = "reply_" + notification.notificationType + "_" + userReplyID; //reply_like_X, reply_read_X
                                            let notifyIndex = _.findIndex(final_notify, function(o) { return o.key == key });
                                            if (notifyIndex == -1) {
                                                let tmp = {
                                                    key: key,
                                                    action: "reply_" + notification.notificationType,
                                                    postID: userPostID,
                                                    replyID: userReplyID,
                                                    body: userReply_comment.body,
                                                    picture: userReply_originalPost.picture,
                                                    time: time + notification.time,
                                                    actors: [notification.actor],
                                                    originalActor: postType == "user" ? { profile: user.profile } : userReply_originalPost.actor,
                                                    unreadNotification: time + notification.time > lastNotifyVisit
                                                }
                                                if (notification.notificationType == 'like') {
                                                    tmp.numLikes = 1
                                                }
                                                notifyIndex = final_notify.push(tmp) - 1;
                                            } else {
                                                if (notification.notificationType == 'like') {
                                                    final_notify[notifyIndex].numLikes += 1;
                                                }
                                                //if generic-joe, append. else, shift to the front of the line.
                                                if (notification.notificationType == "read" && notification.actor.username == "generic-joe") {
                                                    final_notify[notifyIndex].actors.push(notification.actor);
                                                } else {
                                                    final_notify[notifyIndex].actors.unshift(notification.actor);
                                                }
                                                if (time + notification.time > final_notify[notifyIndex].time) {
                                                    final_notify[notifyIndex].time = time + notification.time;
                                                }
                                                if (time + notification.time > lastNotifyVisit) {
                                                    final_notify[notifyIndex].unreadNotification = true;
                                                }
                                            }
                                            if (notification.notificationType == 'like') {
                                                if (postType == "user") {
                                                    let postIndex = _.findIndex(user.posts, function(o) { return o.postID == userPostID; });
                                                    let commentIndex = _.findIndex(user.posts[postIndex].comments, function(o) { return o.commentID == userReplyID && o.new_comment == true });
                                                    user.posts[postIndex].comments[commentIndex].likes = final_notify[notifyIndex].numLikes;
                                                } else {
                                                    let postIndex = _.findIndex(user.feedAction, function(o) { return o.post.equals(userPostID); });
                                                    let commentIndex = _.findIndex(user.feedAction[postIndex].comments, function(o) { return o.new_comment_id == userReplyID && o.new_comment == true });
                                                    user.feedAction[postIndex].comments[commentIndex].likes = final_notify[notifyIndex].numLikes;
                                                }
                                            }
                                        }
                                    }
                                } //end of for FOR LOOP

                                final_notify.sort(function(a, b) {
                                    return b.time - a.time;
                                });

                                //save the Page Log
                                user.save((err) => {
                                    if (err) {
                                        return next(err);
                                    }
                                    //req.flash('success', { msg: 'Profile information has been updated.' });
                                });

                                let newNotificationCount = final_notify.filter(notification => notification.unreadNotification == true).length;
                                if (req.query.bell) {
                                    return res.send({ count: newNotificationCount });
                                } else {
                                    return res.render('notification', {
                                        notification_feed: final_notify,
                                        user_posts: userPosts,
                                        actor_posts: actorPosts,
                                        count: newNotificationCount
                                    })
                                }
                            }); //end of NOTIFICATION exec
                    }); //end of Script.find
            }); //end of User.findbyID
    } //end of if (req.user)
};