const mongoose = require('mongoose');
const Schema = mongoose.Schema;

function timeStringToNum(v) {
    var timeParts = v.split(":");
    return ((timeParts[0] * (60000 * 60)) + (timeParts[1] * 60000));
}

const notificationSchema = new mongoose.Schema({
    actor: { type: Schema.ObjectId, ref: 'Actor' }, //actor who did the action (read,likes, replied),
    notificationType: String, //('like', 'read', 'reply')
    time: Number, //in milliseconds, relative to the comment or post posting time

    userPost: Number, //which user post this action is for (0,1,2....n)
    userReply: Number, //which user reply this action is for (0,1,2....n)
    actorReply: Number, //Ref for an action on a Actor reply (like reads, likes, etc) //TODO:???
    replyBody: { type: String, default: '', trim: true }, //body of actor's reply

}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;