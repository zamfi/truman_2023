const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true },
    password: String,
    // passwordResetToken: String,
    // passwordResetExpires: Date,
    username: String,
    active: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },

    endSurveyLink: String,

    numPosts: { type: Number, default: -1 }, //# of user posts
    numComments: { type: Number, default: -1 }, //# of comments on posts (user and actor), it is used for indexing and commentID of uesr comments on posts (user and actor)
    numActorReplies: { type: Number, default: -1 }, //# of actor replies on user posts, it is used for indexing and commentID of actor comments on user posts

    numPostLikes: { type: Number, default: 0 }, //# of actor posts liked
    numCommentLikes: { type: Number, default: 0 }, //# of actor comments liked

    lastNotifyVisit: Date, //Absolute Time, most recent visit to /notifications. First initialization is at account creation
    createdAt: Date, //Absolute Time user was created
    consent: { type: Boolean, default: false }, //Indicates if user has proceeded through welcome signup pages

    mturkID: String,

    group: String, //full group type for post displays. Values: 'var1', 'var2', 'var3'

    tokens: Array,

    blocked: [String], //list of usernames of actors user has blocked
    reported: [String], //list of usernames of actors user has reported
    followed: [String], //list of usernames of actors user has followed
    blockReportAndFollowLog: [new Schema({
        time: Date,
        action: String,
        report_issue: String,
        actorName: String
    })],

    study_days: { //how many times the user looked at the feed per day
        type: [Number],
        default: [0, 0]
    }, //TODO: Update. It inaccurately +1, whenever creates a new post.

    // User Made posts
    posts: [new Schema({
        type: String, //Value: user_post
        postID: Number, //postID for user post (0,1,2,3...)
        body: { type: String, default: '', trim: true }, //body of post
        picture: String, //picture for post
        liked: { type: Boolean, default: false }, //has the user liked it?
        likes: { type: Number, default: 0 }, //number of likes on post by actors (excludes user's like)

        //Comments for User Made Posts
        comments: [new Schema({
            actor: { type: Schema.ObjectId, ref: 'Actor' }, //If comment is by Actor
            body: { type: String, default: '', trim: true }, //body of comment
            commentID: Number, //ID of the comment
            relativeTime: Number, //in milliseconds, relative time to when the user created their account
            absTime: Date, //Exact time comment is made
            new_comment: { type: Boolean, default: false }, //is this a comment from user?
            liked: { type: Boolean, default: false }, //has the user liked it?
            flagged: { type: Boolean, default: false }, //has the user flagged it?
            likes: { type: Number, default: 0 } //number of likes on comment by actors (excludes user's like)
        }, { versionKey: false })],

        absTime: Date, //Exact time post is made
        relativeTime: { type: Number } //in milliseconds, relative time to when the user created their account
    })],

    log: [new Schema({ //Logins
        time: Date,
        userAgent: String,
        ipAddress: String
    })],

    pageLog: [new Schema({ //Page visits
        time: Date,
        page: String //URL
    })],

    pageTimes: { //how much time the user spent on the website per day
        type: [Number],
        default: [0, 0]
    },

    postStats: {
        SiteVisits: Number, //Total number of times the user has logged into the website
        Day1_visit: Number, //Number of times the user has logged into the website on Day 1
        Day2_visit: Number, //Number of times the user has logged into the website on Day 2
        GeneralTimeSpent: Number, //Time spent on website
        Day1_timespent: Number, //Time spent on website on Day 1
        Day2_timespent: Number, //Time spent on website on Day 2
        GeneralPostNumber: Number, //# of posts made by user
        Day1_posts: Number, //# of posts made by user on Day 1
        Day2_posts: Number, //# of posts made by user on Day 2
        GeneralPostLikes: Number, //# of posts liked
        GeneralCommentLikes: Number, //# of likes on comments
        GeneralPostComments: Number, //# of comments left on normal posts
    },

    feedAction: [new Schema({
        post: { type: Schema.ObjectId, ref: 'Script' },
        postClass: String, //Used for post classification purposes.
        mostRecentTime: Date, //Absolute Time, the most recent Date the post was viewed
        rereadTimes: { type: Number, default: 0 }, //number of times post has been viewed by user.

        liked: { type: Boolean, default: false }, //has the user liked it?
        flagged: { type: Boolean, default: false }, // has the user flagged it?
        likeTime: [Date], //absoluteTimes of times user has liked the post
        unlikeTime: [Date], //absoluteTimes of times user has unliked the post
        flagTime: [Date], //absoluteTimes of times user has flagged the post
        hidden: { type: Boolean, default: false }, //has the user hidden it? Used for Ads only.
        hideTime: [Date], //absoluteTimes of times user has hidden the post
        readTime: [Number], //in milliseconds, how long the user spent looking at the post (we do not record times less than 1.5 seconds and more than 24 hrs)

        comments: [new Schema({
            comment: { type: Schema.ObjectId }, //ID Reference for Script post comment
            liked: { type: Boolean, default: false }, //has the user liked it?
            flagged: { type: Boolean, default: false }, //has the user flagged it?
            likeTime: [Date], //absoluteTimes of times user has liked the 
            unlikeTime: [Date], //absoluteTimes
            flagTime: [Date], //absoluteTimes of times user has flagged the comment
            new_comment: { type: Boolean, default: false }, //is this a comment from user?
            new_comment_id: Number, //ID for comment
            body: String, //Body of comment
            absTime: Date, //Exact time comment was made
            relativeTime: Number, //in milliseconds, relative time comment was made to when the user created their account
            likes: { type: Number, default: 0 }, //number of likes comments has
        }, { _id: true, versionKey: false })]
    }, { _id: true, versionKey: false })],

    profile: {
        name: String,
        location: String,
        bio: String,
        picture: String
    }
}, { timestamps: true, versionKey: false });

/**
 * Password hash middleware.
 */
userSchema.pre('save', function save(next) {
    const user = this;
    if (!user.isModified('password')) { return next(); }
    bcrypt.genSalt(10, (err, salt) => {
        if (err) { return next(err); }
        bcrypt.hash(user.password, salt, (err, hash) => {
            if (err) { return next(err); }
            user.password = hash;
            next();
        });
    });
});

/**
 * Helper method for validating user's password.
 */
userSchema.methods.comparePassword = function comparePassword(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
        cb(err, isMatch);
    });
};

/**
 * Add login instance to user.log
 */
userSchema.methods.logUser = function logUser(time, agent, ip) {
    var log = {
        time: time,
        userAgent: agent,
        ipAddress: ip
    };
    this.log.push(log);
    this.save((err) => {
        if (err) {
            return next(err);
        }
    });
};

/**
 * Add page visit instance to user.pageLog
 */
userSchema.methods.logPage = function logPage(time, page) {
    const log = {
        time: time,
        page: page
    };
    this.pageLog.push(log);
};

/** Calculate stats: Basic user statistics (not comprehensive) 
 * Also displayed in /completed for admin accounts.
 */
userSchema.methods.logPostStats = function logPage() {
    var one_day = 86400000; // number of milliseconds in a day

    const counts = this.feedAction.reduce(function(newCount, feedAction) {
            const numLikes = feedAction.comments.filter(comment => comment.liked && !comment.new_comment).length;
            const numNewComments = feedAction.comments.filter(comment => comment.new_comment).length;

            newCount[0][0] += numLikes;
            newCount[0][1] += numNewComments;
            return newCount;
        }, [0, 0], //Normal Post [actorLikes, newComments]
    );

    const Day1_posts = this.posts.filter(post => post.relativeTime <= one_day).length;
    const Day2_posts = this.posts.filter(post => post.relativeTime > one_day && post.relativeTime <= one_day * 2).length;

    const CompletedDay1 = Day1_posts >= 1 && this.pageTimes[0] > 180000;
    const CompletedDay2 = Day2_posts >= 1 && this.pageTimes[1] > 180000;

    let log = {
        CompletedDay1: CompletedDay1,
        CompletedDay2: CompletedDay2,
        SiteVisits: this.log.length, //Total number of times the user has logged into the website
        Day1_visit: this.log.filter(log => log.time - this.createdAt <= one_day).length, //Number of times the user has logged into the website on Day 1
        Day2_visit: this.log.filter(log => (log.time - this.createdAt > one_day) && (log.time - this.createdAt <= one_day * 2)).length, //Number of times the user has logged into the website oon Day 2
        GeneralTimeSpent: this.pageTimes[0] + this.pageTimes[1], //Approximate time spent on website
        GeneralPostNumber: this.numPosts + 1, //# of posts made by user
        Day1_posts: Day1_posts, //# of posts made by user on Day 1
        Day2_posts: Day2_posts, //# of posts made by user on Day 2
        GeneralPostLikes: this.feedAction.filter(feedAction => feedAction.liked).length, //# of posts liked
        GeneralCommentLikes: counts[0][0], //# of likes on actor comments
        GeneralPostComments: counts[0][1], //# of user comments left on posts
    };
    this.postStats = log;
    this.completed = CompletedDay1 && CompletedDay2;
};

/**
 * Helper method for getting all User Posts.
 */
userSchema.methods.getPosts = function getPosts() {
    var ret = this.posts;
    ret.sort(function(a, b) {
        return b.relativeTime - a.relativeTime;
    });
    for (const post of ret) {
        post.comments.sort(function(a, b) {
            return a.relativeTime - b.relativeTime;
        });
    }
    return ret;
};

//Return the user post from its ID
userSchema.methods.getUserPostByID = function(postID) {
    return this.posts.find(x => x.postID == postID);
};

//get user posts within the min/max time period
userSchema.methods.getPostInPeriod = function(min, max) {
    return this.posts.filter(function(post) {
        return post.relativeTime >= min && post.relativeTime <= max;
    });
}

/**
 * Helper method for getting user's gravatar.
 */
userSchema.methods.gravatar = function gravatar(size) {
    if (!size) {
        size = 200;
    }
    if (!this.email) {
        return `https://gravatar.com/avatar/?s=${size}&d=retro`;
    }
    const md5 = crypto.createHash('md5').update(this.email).digest('hex');
    return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
};

const User = mongoose.model('User', userSchema);
module.exports = User;