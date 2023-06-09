const mongoose = require('mongoose');

const actorSchema = new mongoose.Schema({
    username: String,
    profile: {
        name: String,
        gender: String,
        age: Number,
        location: String,
        bio: String,
        picture: String
    },
    class: String
}, { timestamps: true });

const Actor = mongoose.model('Actor', actorSchema);
module.exports = Actor;