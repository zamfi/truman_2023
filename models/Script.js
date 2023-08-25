const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scriptSchema = new mongoose.Schema({
    postID: Number, //ID of the post (0, 1, 2, 3, ... )
    body: { type: String, default: '', trim: true }, //body (text) of post
    picture: String, //picture (file path) for post
    likes: Number, //number of likes of post (randomly assigned in populate.js)
    actor: { type: Schema.ObjectId, ref: 'Actor' }, //actor of post
    time: Number, //in milliseconds, relative to how much time has passed since the user created their account

    class: String, //For experimental use (can be used to define the type of post)

    // Sorted by least recent --> most recent
    comments: [new Schema({
        commentID: Number, //ID of the comment (0, 1, 2, 3, ... )
        body: { type: String, default: '', trim: true }, //body (text) of comment
        likes: Number, //number of likes of comment (randomly assigned in populate.js)
        actor: { type: Schema.ObjectId, ref: 'Actor' }, //actor of comment
        time: Number, //in milliseconds, relative to how much time has passed since the user created their account

        new_comment: { type: Boolean, default: false },
        liked: { type: Boolean, default: false },
    }, { versionKey: false })]
}, { versionKey: false });

const Script = mongoose.model('Script', scriptSchema);
module.exports = Script;