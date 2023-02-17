const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true },
    password: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    username: String,
    active: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },

    endSurveyLink: String,

    numPosts: { type: Number, default: -1 }, //not including replys
    numComments: { type: Number, default: -1 }, //# of comments on posts (user and actor), it is used for indexing and commentID of uesr comments on posts (user and actor)
    numActorReplies: { type: Number, default: -1 }, //# of actor replies on user posts, it is used for indexing and commentID of actor comments on user posts

    numPostLikes: { type: Number, default: 0 }, //# of actor posts liked
    numCommentLikes: { type: Number, default: 0 }, //# of actor comments liked

    lastNotifyVisit: Date,
    createdAt: Date,
    consent: { type: Boolean, default: false }, //Indicates if user has proceeded through welcome signup pages

    mturkID: String,

    group: String, //full group type for post displays
    interest: String,

    transparency: String, //just UI type (no or yes)
    comment_prompt: String, //notification type (no or yes)

    tokens: Array,

    blocked: [String], //list of usernames of actors user has blocked
    reported: [String],

    study_days: { //how many times the user looked at the feed per day
        type: [Number],
        default: [0, 0]
    }, //To do: Update. It inaccurately +1, whenever creates a new post.

    // User created posts
    posts: [new Schema({
        type: String, //"user_post"... reply, actorReply
        postID: Number, //number for this post (1,2,3...) reply get -1 maybe should change to a String ID system
        body: { type: String, default: '', trim: true }, //body of post or reply
        picture: String, //picture for post
        liked: { type: Boolean, default: false }, //has the user liked it?
        likes: { type: Number, default: 0 },

        //Comments for User Made Posts
        comments: [new Schema({
            actor: { type: Schema.ObjectId, ref: 'Actor' }, //If comment is by Actor
            body: { type: String, default: '', trim: true }, //body of post or reply
            commentID: Number, //ID of the comment
            relativeTime: Number, //in milliseconds, relative time to when the user created their account
            absTime: Date, //Exact time comment is made
            new_comment: { type: Boolean, default: false }, //is this a new comment from user
            // isUser: { type: Boolean, default: false }, //is this a comment on own post
            liked: { type: Boolean, default: false }, //is Liked?
            flagged: { type: Boolean, default: false }, //is Flagged?
            likes: { type: Number, default: 0 }
        }, { versionKey: false })],

        // replyID: Number, //use this for User Replies
        // reply: { type: Schema.ObjectId, ref: 'Script' }, //Actor Post reply is to =>

        // actorReplyID: Number, //An Actor reply to a User Post
        // actorReplyOBody: String, //Original Body of User Post
        // actorReplyOPicture: String, //Original Picture of User Post
        // actorReplyORelativeTime: Number,
        // actorAuthor: { type: Schema.ObjectId, ref: 'Actor' },

        absTime: Date, //Exact time post is made
        relativeTime: { type: Number } //in milliseconds, relative time to when the user created their account
    })],

    log: [new Schema({
        time: Date,
        userAgent: String,
        ipAddress: String
    })],

    pageLog: [new Schema({
        time: Date,
        page: String
    })],

    postStats: [new Schema({
        postID: Number,
        citevisits: Number,
        generalpagevisit: Number,
        DayOneVists: Number,
        DayTwoVists: Number,
        DayThreeVists: Number,
        GeneralLikeNumber: Number,
        GeneralPostLikes: Number,
        GeneralCommentLikes: Number,
        GeneralFlagNumber: Number,
        GeneralPostNumber: Number,
        GeneralCommentNumber: Number
    })],

    blockAndReportLog: [new Schema({
        time: Date,
        action: String,
        report_issue: String,
        actorName: String
    })],

    profile_feed: [new Schema({
        profile: String,
        startTime: Number, //always the newest startTime (full date in ms)
        rereadTimes: Number,
        readTime: [Number],
        picture_clicks: [Number],
    })],

    feedAction: [new Schema({
        post: { type: Schema.ObjectId, ref: 'Script' },
        postClass: String,
        rereadTimes: Number, //number of times post has been viewed by user
        startTime: { type: Number, default: 0 }, //always the newest startTime (full date in ms)
        liked: { type: Boolean, default: false },
        likeTime: [Date], //absoluteTimes
        unlikeTime: [Date], //absoluteTimes
        flagTime: [Date], //absoluteTimes
        readTime: [Date],

        replyTime: [Date], //absoluteTimes

        //how long the user spent looking at the post (does not record times less than 1.5 seconds)

        comments: [new Schema({
            comment: { type: Schema.ObjectId }, //ID Reference for Script post comment
            liked: { type: Boolean, default: false }, //is liked?
            flagged: { type: Boolean, default: false }, //is Flagged?
            flagTime: [Date], //absoluteTimes
            likeTime: [Date], //absoluteTimes
            unlikeTime: [Date], //absoluteTimes
            new_comment: { type: Boolean, default: false }, //is new comment
            new_comment_id: Number, //ID for comment
            comment_body: String, //Body of comment
            absTime: Date, //Exact time comment was made
            relativeTime: Number, //in milliseconds, relative time comment was made to when the user created their account
            likes: { type: Number, default: 0 }, // TODO: -- not used
        }, { _id: true, versionKey: false })]
    }, { _id: true, versionKey: false })],

    profile: {
        name: String,
        gender: String,
        location: String,
        bio: String,
        website: String,
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
 * Add Log to User
 */
userSchema.methods.logUser = function logUser(time, agent, ip) {
    var log = {};
    log.time = time;
    log.userAgent = agent;
    log.ipAddress = ip;
    this.log.push(log);
    this.save((err) => {
        if (err) {
            return next(err);
        }
    });

};

userSchema.methods.logPage = function logPage(time, page) {
    const log = {
        time: time,
        page: page
    };
    this.pageLog.push(log);
};

userSchema.methods.logPostStats = function logPage(postID) {
    let log = {};
    log.postID = postID;
    log.citevisits = this.log.length;
    log.generalpagevisit = this.pageLog.length;

    if (this.study_days.length > 0) {
        log.DayOneVists = this.study_days[0];
        log.DayTwoVists = this.study_days[1];
        //log.DayThreeVists = this.study_days[2];
    }

    log.GeneralLikeNumber = this.numPostLikes + this.numCommentLikes;
    log.GeneralPostLikes = this.numPostLikes;
    log.GeneralCommentLikes = this.numCommentLikes;
    log.GeneralFlagNumber = 0;

    for (var k = this.feedAction.length - 1; k >= 0; k--) {
        if (this.feedAction[k].post != null) {
            if (this.feedAction[k].liked) {
                //log.GeneralLikeNumber++;
            }
            //total number of flags
            if (this.feedAction[k].flagTime[0]) {
                log.GeneralFlagNumber++;
            }
        }
    }

    log.GeneralPostNumber = this.numPosts + 1;
    log.GeneralCommentNumber = this.numComments + 1;

    this.postStats.push(log);
};

/**
 * Helper method for getting all User Posts.
 */
userSchema.methods.getPosts = function getPosts() {
    var temp = [];
    for (var i = 0, len = this.posts.length; i < len; i++) {
        if (this.posts[i].postID >= 0)
            temp.push(this.posts[i]);
    }
    //sort to ensure that posts[x].postID == x
    temp.sort(function(a, b) {
        return a.postID - b.postID;
    });
    return temp;
};

/**
 * Helper method for getting all User Posts and replies.
 */
userSchema.methods.getPostsAndReplies = function getPostsAndReplies() {
    var temp = [];
    for (var i = 0, len = this.posts.length; i < len; i++) {
        if (this.posts[i].postID >= 0 || this.posts[i].replyID >= 0)
            temp.push(this.posts[i]);
    }
    //sort to ensure that posts[x].postID == x
    temp.sort(function(a, b) {
        return a.absTime - b.absTime;
    });
    return temp;
};

//Return the user post from its ID
userSchema.methods.getUserPostByID = function(postID) {
    return this.posts.find(x => x.postID == postID);
};


//Return the user reply from its ID
userSchema.methods.getUserReplyByID = function(replyID) {
    return this.posts.find(x => x.replyID == replyID);
};

//Return the user reply from its ID
userSchema.methods.getActorReplyByID = function(actorReplyID) {
    return this.posts.find(x => x.actorReplyID == actorReplyID);

};

//get user posts within the min/max time period
userSchema.methods.getPostInPeriod = function(min, max) {
    //concat posts & reply
    return this.posts.filter(function(item) {
        return item.relativeTime >= min && item.relativeTime <= max;
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