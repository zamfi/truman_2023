const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scriptSchema = new mongoose.Schema({
    postID: Number,
    body: { type: String, default: '', trim: true },
    picture: String,
    likes: Number,
    actor: { type: Schema.ObjectId, ref: 'Actor' },
    time: Number, //in milliseconds, relative time to when the user created their account

    class: String, //'Ad' or 'Normal' (type of post)

    // Sorted by least recent --> most recent
    comments: [new Schema({
        commentID: Number, //ID of the comment
        body: { type: String, default: '', trim: true }, //body of reply
        likes: Number,
        actor: { type: Schema.ObjectId, ref: 'Actor' },
        time: Number, //in milliseconds, relative time to when the user created their account

        new_comment: { type: Boolean, default: false },
        liked: { type: Boolean, default: false },
    }, { versionKey: false })]
}, { versionKey: false });

const Script = mongoose.model('Script', scriptSchema);
module.exports = Script;