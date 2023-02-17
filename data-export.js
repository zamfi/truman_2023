#! /usr/bin/env node

console.log('This data export is running!!!!');


const async = require('async')
const Actor = require('./models/Actor.js');
const Script = require('./models/Script.js');
const User = require('./models/User.js');
const _ = require('lodash');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const fs = require('fs')
var UAParser = require('ua-parser-js');
const util = require('util');



var csvWriter = require('csv-write-stream');
var mlm_writer = csvWriter();
var s_writer = csvWriter();
var summary_writer = csvWriter();
//5bb3a93ad9fd14471bf3977d
//5bb3a93ad9fd14471bf39791
//5bb3a93ad9fd14471bf39792
//5bb3a93ad9fd14471bf397c8
/*var bully_messages = ["5bb3a93ad9fd14471bf3977d",
"5bb3a93ad9fd14471bf39791",
"5bb3a93ad9fd14471bf39792",
"5bb3a93ad9fd14471bf397c8"];*/
var bully_stats = [];
var sur_array = [];

//postIDs for the posts and comments we have interest in
//UPDATE THESE WHENEVER NODE POPULATE IS RUN.
day1Flagged = "5db98c32ed2b9b5a43880b2b"; //chicken parm, you guys!
day1FlaggedCommentUnambig = "5db98c36ed2b9b5a438817bb"; //is she pregnant?
day1FlaggedCommentAmbig = "5db98c36ed2b9b5a438817bc"; //ummmm imma pass
day1NotFlagged = "5db98c32ed2b9b5a43880a60"; //i had this pizza yesterday
day1NotFlaggedComment = "5db98c37ed2b9b5a438817bd"; //when will you get it into your head

day2Flagged = "5db98c32ed2b9b5a43880b0d"; //here's my attempt at bruschetta
day2FlaggedCommentUnambig = "5db98c37ed2b9b5a438817be"; //this photo is uglier than you
day2FlaggedCommentAmbig = "5db98c38ed2b9b5a438818d7"; //plzzz don't ever cook this for me
day2NotFlagged = "5db98c32ed2b9b5a43880a9a"; //AFTERNOON SNACKTIME !!!
day2NotFlaggedComment = "5db98c38ed2b9b5a438818d8"; //Everyone hates you

otherComment229 = "5db98c37ed2b9b5a43881863"; //dinner of champions!
otherComment263 = "5db98c37ed2b9b5a43881881"; //so pretty!
otherComment150 = "5db98c37ed2b9b5a43881818"; // first try!
otherComment310 = "5db98c37ed2b9b5a438818a6"; //nice!
//end custom ids


Array.prototype.sum = function() {
    return this.reduce(function(a,b){return a+b;});
};



var mlm_array = [];

//dotenv.load({ path: '.env' });
dotenv.config({path: '.env'});

/*
var MongoClient = require('mongodb').MongoClient
 , assert = require('assert');


//var connection = mongo.connect('mongodb://127.0.0.1/test');
mongoose.connect(process.env.PRO_MONGODB_URI || process.env.PRO_MONGOLAB_URI);
var db = mongoose.connection;
mongoose.connection.on('error', (err) => {
  console.error(err);
  console.log('%s MongoDB connection error. Please make sure MongoDB is running.', chalk.red('✗'));
  process.exit();
}); */

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;

//mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
//mongoose.connect(process.env.MONGOLAB_TEST || process.env.PRO_MONGOLAB_URI, { useMongoClient: true });
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, { useNewUrlParser: true });
mongoose.connection.on('error', (err) => {
  console.log('%s MongoDB connection error. Please make sure MongoDB is running.', chalk.red('✗'));
  console.error(err);
  process.exit();
});


User.find()
  .where('active').equals(false)
  .populate({
         path: 'feedAction.post',
         model: 'Script',
         populate: {
           path: 'actor',
           model: 'Actor'
         }
      })
  .exec(
    function(err, users){

      mlm_writer.pipe(fs.createWriteStream('results/mlm_eatsnaplove.csv'));
      //s_writer.pipe(fs.createWriteStream('results/posts_eatsnaplove.csv'));
      summary_writer.pipe(fs.createWriteStream('results/sum_eatsnaplove.csv'));

      for (var i = users.length - 1; i >= 0; i--) //for each inactive user in the users table
      {

        var mlm = {};
        var sur = {};
        var sums = {};
        mlm.id = users[i].mturkID;
        sur.id = users[i].mturkID;
        sums.id = users[i].mturkID;


        mlm.email = users[i].email;
        sur.email = users[i].email;
        sums.email = users[i].email;

        mlm.StartDate = users[i].createdAt;
        sur.StartDate = users[i].createdAt;
        sums.StartDate = users[i].createdAt;

        console.log("In User "+ users[i].email);
        //console.log("In User Number "+ i);

        //UI - transparency script_type: String, //type of script they are running in
        //post_nudge: String,

        //mlm.script_type = users[i].script_type;
        //sums.script_type = users[i].script_type;

        //study group information

        //moderation type, comment type (changing mod type labels from db for better readability)
        if(users[i].flag_group === "none"){
          mlm.moderationType = "unknown";
          sums.moderationType = "unknown";
        } else if (users[i].flag_group === "ai"){
          mlm.moderationType = "automated";
          sums.moderationType = "automated";
        } else if (users[i].flag_group === "user"){
          mlm.moderationType = "users";
          sums.moderationType = "users";
        } else { //this case should NEVER happen, but including as a precaution
          mlm.moderationType = "?";
          sums.moderationType = "?";
        }

        mlm.commentType = users[i].bully_group;
        sums.commentType = users[i].bully_group;

        //profile_perspective, uses booleans to indicate if a change was made
        /*if (users[i].post_nudge == 'yes')
        {
          mlm.post_nudge = 1;
          sums.post_nudge = 1;
        }
        else
        {
          mlm.post_nudge = 0;
          sums.post_nudge = 0;
        }*/


        if (users[i].profile.name)
        {
          mlm.ProfileName = 1;
          //sums.ProfileName = 1;
        }
        else
        {
          mlm.ProfileName = 0;
          //sums.ProfileName = 0;
        }

        if (users[i].profile.location)
        {
          mlm.ProfileLocation = 1;
          //sums.ProfileLocation = 1;
        }
        else
        {
          mlm.ProfileLocation = 0;
          //sums.ProfileLocation = 0;
        }

        if (users[i].profile.bio)
        {
          mlm.ProfileBio = 1;
          //sums.ProfileBio = 1;
        }
        else
        {
          mlm.ProfileBio = 0;
          //sums.ProfileBio = 0;
        }

        if (users[i].profile.picture)
        {
          mlm.ProfilePicture = 1;
          //sums.ProfilePicture = 1;
        }
        else
        {
          mlm.ProfilePicture = 0;
          //sums.ProfilePicture = 0;
        }

        var parser = new UAParser();

        if(users[i].log[0])
        {

          if (parser.setUA(users[i].log[0].userAgent).getDevice().type)
          {
            mlm.Device = parser.setUA(users[i].log[0].userAgent).getDevice().type;
          }
          else
            mlm.Device = "Computer";



          //sur.Device = mlm.Device;

          mlm.Broswer = parser.setUA(users[i].log[0].userAgent).getBrowser().name;
          //sur.Broswer = mlm.Broswer;

          mlm.OS = parser.setUA(users[i].log[0].userAgent).getOS().name;
          //sur.OS = mlm.OS;
        }//if Log exists
        else{
          mlm.Device = "NA";
          mlm.Broswer = "NA";
          mlm.OS = "NA";
        }

        //reporting if the user completed the study or not
        //log in 2x per day
        //created 1 post per day
        var day1_loginCount = 0;
        var day2_loginCount = 0;

        for(logIndex = users[i].log.length-1; logIndex >= 0; logIndex--){
          if(users[i].log[logIndex].time.getTime() <= (users[i].createdAt.getTime() + 86400000)){
            day1_loginCount++;
          }else if ((users[i].log[logIndex].time.getTime() > (users[i].createdAt.getTime() + 86400000)) && (users[i].log[logIndex].time.getTime() <= (users[i].createdAt.getTime() + 172800000))){
            day2_loginCount++;
          }
        }

        var day1_postCount = 0;
        var day2_postCount = 0;

        for(userPostIndex = users[i].posts.length-1; userPostIndex >= 0; userPostIndex--){
          if(users[i].posts[userPostIndex].absTime.getTime() <= (users[i].createdAt.getTime() + 86400000)){
            day1_postCount++;
          }else if ((users[i].posts[userPostIndex].absTime.getTime() > (users[i].createdAt.getTime() + 86400000)) && (users[i].posts[userPostIndex].absTime.getTime() <= (users[i].createdAt.getTime() + 172800000))){
            day2_postCount++;
          }
        }

        if((day1_loginCount >=2) && (day2_loginCount >= 2) && (day1_postCount >=1) && (day2_postCount >= 1)) {
          mlm.CompletedStudy = 1;
          sums.CompletedStudy = 1;
        } else {
          mlm.CompletedStudy = 0;
          sums.CompletedStudy = 0;
        }

        if(((day1_loginCount >=2) && (day1_postCount >=1)) || ((day2_loginCount >= 2) && (day2_postCount >= 1))) {
          mlm.MinimumOneDayCompleted = 1;
          sums.MinimumOneDayCompleted = 1;
        } else {
          mlm.MinimumOneDayCompleted = 0;
          sums.MinimumOneDayCompleted = 0;
        }

        if((day1_loginCount >=2) && (day1_postCount >=1)) {
          mlm.CompletedDay1 = 1;
          sums.CompletedDay1 = 1;
        } else {
          mlm.CompletedDay1 = 0;
          sums.CompletedDay1 = 0;
        }

        if((day2_loginCount >=2) && (day2_postCount >=1)) {
          mlm.CompletedDay2 = 1;
          sums.CompletedDay2 = 1;
        } else {
          mlm.CompletedDay2 = 0;
          sums.CompletedDay2 = 0;
        }

        mlm.siteLogins = users[i].log.length;
        mlm.GeneralPostNumber = users[i].numPosts + 1;

        mlm.day1_logins = day1_loginCount;
        mlm.day1_posts = day1_postCount;
        mlm.day2_logins = day2_loginCount;
        mlm.day2_posts = day2_postCount;

        sums.day1_logins = day1_loginCount;
        sums.day1_posts = day1_postCount;
        sums.day2_logins = day2_loginCount;
        sums.day2_posts = day2_postCount;

        sums.siteLogins = users[i].log.length;
        sums.GeneralPostNumber = users[i].numPosts + 1;
        sums.GeneralCommentNumber = users[i].numComments + 1;



      /*if (users[i].completed)
        {
          mlm.CompletedStudy = 1;
          sums.CompletedStudy = 1;
          //sur.CompletedStudy = 1;
        }
        else
        {
          mlm.CompletedStudy = 0;
          sums.CompletedStudy = 0;
          //sur.CompletedStudy = 0;
        }*/

        if (users[i].study_days.length > 0) //how many visits per day of the study
        {
          mlm.DayOneVists = users[i].study_days[0];
          mlm.DayTwoVists = users[i].study_days[1];
          //mlm.DayThreeVists = users[i].study_days[2];

          sums.DayOneVists = users[i].study_days[0];
          sums.DayTwoVists = users[i].study_days[1];
          //sums.DayThreeVists = users[i].study_days[2];
        }


        mlm.GeneralLikeNumber = 0;
        mlm.GeneralPostLikes = 0;
        mlm.GeneralCommentLikes = 0;
        mlm.GeneralFlagNumber = 0;
        mlm.GeneralPostFlags = 0;
        mlm.GeneralCommentFlags = 0;


        mlm.GeneralCommentNumber = users[i].numComments + 1;

        //info about specific page views
        mlm.visits_notification = 0;
        mlm.visits_policy = 0;
        mlm.visits_day1_flagged_victim = 0;
        mlm.visits_day1_flagged_bully = 0;
        mlm.visits_day1_notflagged_victim = 0;
        mlm.visits_day1_notflagged_bully = 0;
        mlm.visits_day2_flagged_victim= 0;
        mlm.visits_day2_flagged_bully = 0;
        mlm.visits_day2_flagged_victim = 0;
        mlm.visits_day2_notflagged_victim = 0;
        mlm.visits_day2_notflagged_bully = 0;
        mlm.visits_general = 0;

        for(var z = 0; z < users[i].pageLog.length; ++z){

            if(users[i].pageLog[z].page == "Notifications"){
              mlm.visits_notification++;
            }else if((users[i].pageLog[z].page == "PolicyComment") ||(users[i].pageLog[z].page == "PolicyMenu")) {
              mlm.visits_policy++;

            //day 1
            }else if (users[i].pageLog[z].page == "casssssssssie") {
              mlm.visits_day1_flagged_victim++;
            }else if (users[i].pageLog[z].page == "bblueberryy"){
              mlm.visits_day1_flagged_bully++;
            }else if (users[i].pageLog[z].page == "jake_turk"){
              mlm.visits_day1_notflagged_victim++;
            }else if (users[i].pageLog[z].page == "jupiterpride"){
              mlm.visits_day1_notflagged_bully++;

            //day 2
            }else if (users[i].pageLog[z].page == "SamTHEMAN"){
              mlm.visits_day2_flagged_victim++;
            }else if (users[i].pageLog[z].page == "Smitty12"){
              mlm.visits_day2_flagged_bully++;
            }else if (users[i].pageLog[z].page == "southerngirlCel"){
              mlm.visits_day2_notflagged_victim++;
            }else if (users[i].pageLog[z].page == "sweetpea"){
              mlm.visits_day2_notflagged_bully++;

            }else{
              mlm.visits_general++;
            }
        }//end of pageLog loop

        //Responses and times for day 1
        mlm.day1_modResponse = users[i].day1Response;
        mlm.day1_modResponseTime = users[i].day1ResponseTime;
        mlm.day1_policyResponse = users[i].day1ViewPolicyResponse;
        mlm.day1_policyResponseTime = users[i].day1ViewPolicyResponseTime;
        mlm.day1_totalPolicyViews = users[i].day1ViewPolicySources.length;
        mlm.day1_firstPolicyViewTime = 0;
        mlm.day1_averagePolicyViewTime = 0;
        if(users[i].day1ViewPolicyTimes.length > 0){
          mlm.day1_firstPolicyViewTime = users[i].day1ViewPolicyTimes[0];
          var averagePolicyViewTime = 0;
          for(v = 0; v < users[i].day1ViewPolicyTimes.length; v++){
            averagePolicyViewTime = averagePolicyViewTime + users[i].day1ViewPolicyTimes[v];
          }
          averagePolicyViewTime = averagePolicyViewTime / users[i].day1ViewPolicyTimes.length;
          mlm.day1_averagePolicyViewTime = averagePolicyViewTime;
        }
        mlm.day1_policyVisitSources = users[i].day1ViewPolicySources; //this is in order of occurrence

        //responses and times for day 2
        mlm.day2_modResponse = users[i].day2Response;
        mlm.day2_modResponseTime = users[i].day2ResponseTime;
        mlm.day2_policyResponse = users[i].day2ViewPolicyResponse;
        mlm.day2_policyResponseTime = users[i].day2ViewPolicyResponseTime;
        mlm.day2_totalPolicyViews = users[i].day2ViewPolicySources.length;
        mlm.day2_firstPolicyViewTime = 0;
        mlm.day2_averagePolicyViewTime = 0;
        if(users[i].day2ViewPolicyTimes.length > 0){
          mlm.day2_firstPolicyViewTime = users[i].day2ViewPolicyTimes[0];
          var averagePolicyViewTime = 0;
          for(v = 0; v < users[i].day2ViewPolicyTimes.length; v++){
            averagePolicyViewTime = averagePolicyViewTime + users[i].day2ViewPolicyTimes[v];
          }
          averagePolicyViewTime = averagePolicyViewTime / users[i].day2ViewPolicyTimes.length;
          mlm.day2_averagePolicyViewTime = averagePolicyViewTime;
        }
        mlm.day2_policyVisitSources = users[i].day2ViewPolicySources; //this is in order of occurrence

        //per feedAction
        sur.postID = -1;
        sur.body = "";
        sur.picture = "";
        sur.absTime = "";
        sur.siteLogins = -1;
        sur.generalpagevisit = -1;
        sur.DayOneVists = -1;
        sur.DayTwoVists = -1;
        sur.DayThreeVists = -1;
        sur.GeneralLikeNumber = -1;
        sur.GeneralFlagNumber = -1;
        sur.GeneralPostNumber = -1;
        sur.GeneralCommentNumber = -1;


        //big list of ALL possible data labels, so that if a user doens't complete day 2, all of them still show up.
        mlm.day1_Flagged_VictimPost_Liked = 0;
        mlm.day1_Flagged_VictimPost_TimesLiked = 0;
        mlm.day1_Flagged_VictimPost_LastLikeTime = 0;
        mlm.day1_Flagged_VictimPost_Flagged = 0;
        mlm.day1_Flagged_VictimPost_FlaggedTime = 0;
        mlm.day1_Flagged_VictimPost_TotalViews = 0;
        mlm.day1_Flagged_VictimPost_AvgViewTime = 0;
        mlm.day1_Flagged_BullyComment_Liked = 0;
        mlm.day1_Flagged_BullyComment_TimesLiked = 0;
        mlm.day1_Flagged_BullyComment_LastLikeTime = 0;
        mlm.day1_Flagged_BullyComment_Flagged = 0;
        mlm.day1_Flagged_BullyComment_LastFlagTime = 0;
        mlm.day1_Flagged_OtherComment229_Liked = 0;
        mlm.day1_Flagged_OtherComment229_TimesLiked = 0;
        mlm.day1_Flagged_OtherComment229_Flagged = 0;
        mlm.day1_Flagged_OtherComment263_Liked = 0;
        mlm.day1_Flagged_OtherComment263_TimesLiked = 0;
        mlm.day1_Flagged_OtherComment263_Flagged = 0;
        mlm.day1_Flagged_OtherComment150_Liked = 0;
        mlm.day1_Flagged_OtherComment150_TimesLiked = 0;
        mlm.day1_Flagged_OtherComment150_Flagged = 0;
        mlm.day1_NotFlagged_VictimPost_Liked = 0;
        mlm.day1_NotFlagged_VictimPost_TimesLiked = 0;
        mlm.day1_NotFlagged_VictimPost_LastLikeTime = 0;
        mlm.day1_NotFlagged_VictimPost_Flagged = 0;
        mlm.day1_NotFlagged_VictimPost_FlaggedTime = 0;
        mlm.day1_NotFlagged_VictimPost_TotalViews = 0;
        mlm.day1_NotFlagged_VictimPost_AvgViewTime = 0;
        mlm.day1_NotFlagged_BullyComment_Liked = 0;
        mlm.day1_NotFlagged_BullyComment_TimesLiked = 0;
        mlm.day1_NotFlagged_BullyComment_LastLikeTime = 0;
        mlm.day1_NotFlagged_BullyComment_Flagged = 0;
        mlm.day1_NotFlagged_BullyComment_LastFlagTime = 0;
        mlm.day2_Flagged_VictimPost_Liked = 0;
        mlm.day2_Flagged_VictimPost_TimesLiked = 0;
        mlm.day2_Flagged_VictimPost_LastLikeTime = 0;
        mlm.day2_Flagged_VictimPost_Flagged = 0;
        mlm.day2_Flagged_VictimPost_FlaggedTime = 0;
        mlm.day2_Flagged_VictimPost_TotalViews = 0;
        mlm.day2_Flagged_VictimPost_AvgViewTime = 0;
        mlm.day2_Flagged_BullyComment_Liked = 0;
        mlm.day2_Flagged_BullyComment_TimesLiked = 0;
        mlm.day2_Flagged_BullyComment_LastLikeTime = 0;
        mlm.day2_Flagged_BullyComment_Flagged = 0;
        mlm.day2_Flagged_BullyComment_LastFlagTime = 0;
        mlm.day2_Flagged_OtherComment310_Liked = 0;
        mlm.day2_Flagged_OtherComment310_TimesLiked = 0;
        mlm.day2_Flagged_OtherComment310_Flagged = 0;
        mlm.day2_NotFlagged_VictimPost_Liked = 0;
        mlm.day2_NotFlagged_VictimPost_TimesLiked = 0;
        mlm.day2_NotFlagged_VictimPost_LastLikeTime = 0;
        mlm.day2_NotFlagged_VictimPost_Flagged = 0;
        mlm.day2_NotFlagged_VictimPost_FlaggedTime = 0;
        mlm.day2_NotFlagged_VictimPost_TotalViews = 0;
        mlm.day2_NotFlagged_VictimPost_AvgViewTime = 0;
        mlm.day2_NotFlagged_BullyComment_Liked = 0;
        mlm.day2_NotFlagged_BullyComment_TimesLiked = 0;
        mlm.day2_NotFlagged_BullyComment_LastLikeTime = 0;
        mlm.day2_NotFlagged_BullyComment_Flagged = 0;
        mlm.day2_NotFlagged_BullyComment_LastFlagTime = 0;

        //end the big list of data labels!!!
        //Now fill them

        console.log("User has "+ users[i].posts.length+" Posts");
        for (var pp = users[i].posts.length - 1; pp >= 0; pp--)
        {
          var temp_post = {};
          temp_post = JSON.parse(JSON.stringify(sur));


          //console.log("Checking User made post"+ users[i].posts[pp].postID)
          temp_post.postID = users[i].posts[pp].postID;
          temp_post.body = users[i].posts[pp].body;
          temp_post.picture = users[i].posts[pp].picture;
          temp_post.absTime = users[i].posts[pp].absTime;

          var postStatsIndex = _.findIndex(users[i].postStats, function(o) { return o.postID == users[i].posts[pp].postID; });
          if(postStatsIndex!=-1)
          {
              console.log("Check post LOG!!!!!!");
              temp_post.siteLogins = users[i].postStats[postStatsIndex].citevisits;
              temp_post.generalpagevisit = users[i].postStats[postStatsIndex].generalpagevisit;
              temp_post.DayOneVists = users[i].postStats[postStatsIndex].DayOneVists;
              temp_post.DayTwoVists = users[i].postStats[postStatsIndex].DayTwoVists;
              temp_post.DayThreeVists = users[i].postStats[postStatsIndex].DayThreeVists;
              temp_post.GeneralLikeNumber = users[i].postStats[postStatsIndex].GeneralLikeNumber;
              temp_post.GeneralPostLikes = users[i].postStats[postStatsIndex].GeneralPostLikes;
              temp_post.GeneralCommentLikes = users[i].postStats[postStatsIndex].GeneralCommentLikes;
              temp_post.GeneralFlagNumber = users[i].postStats[postStatsIndex].GeneralFlagNumber;
              temp_post.GeneralPostNumber = users[i].postStats[postStatsIndex].GeneralPostNumber;
              temp_post.GeneralCommentNumber = users[i].postStats[postStatsIndex].GeneralCommentNumber;
          }

          sur_array.push(temp_post);
        }

        //per feedAction
        //for (var k = users[i].feedAction.length - 1; k >= 0; k--)
        for (var k = 0; k <= (users[i].feedAction.length - 1); k++)
        {
          var currentAction = users[i].feedAction[k];
          var namePrefix = "";
          //singling out the posts we are interested in (there are 4)
          //TODO: Use dynamic vars to name according to the case so I don't have to copy paste the code 4 times with different vars
          if(currentAction.post !== null){
            if(currentAction.post.id == day1Flagged){
              namePrefix = "day1_Flagged_";
            } else if (currentAction.post.id == day1NotFlagged){
              namePrefix = "day1_NotFlagged_";
            } else if (currentAction.post.id == day2Flagged){
              namePrefix = "day2_Flagged_";
            } else if (currentAction.post.id == day2NotFlagged){
              namePrefix = "day2_NotFlagged_";
            }

            if((currentAction.post.id == day1Flagged) || (currentAction.post.id == day1NotFlagged) || (currentAction.post.id == day2Flagged) || (currentAction.post.id == day2NotFlagged)){
              mlm[namePrefix + "VictimPost_Liked"] = +currentAction.liked;
              mlm[namePrefix +"VictimPost_TimesLiked"] = currentAction.likeTime.length;
              if(currentAction.likeTime.length > 0){
                mlm[namePrefix +"VictimPost_LastLikeTime"] = currentAction.likeTime[currentAction.likeTime.length -1];
              }
              //logic to determine if flagged or not based on if there are any timestamps
              if(currentAction.flagTime.length > 0) {
                mlm[namePrefix +"VictimPost_Flagged"] = 1;
                mlm[namePrefix +"VictimPost_FlaggedTime"] = currentAction.flagTime[currentAction.flagTime.length - 1];
              } else {
                mlm[namePrefix +"VictimPost_Flagged"] = 0;
              }
              mlm[namePrefix +"VictimPost_TotalViews"] = currentAction.viewedTime.length;
              //calculate average view time for the post
              var averageVictimPostViewTime = 0;
              for(var m = currentAction.viewedTime.length - 1; m >= 0; m--){
                averageVictimPostViewTime = averageVictimPostViewTime + currentAction.viewedTime[m];
              }
              if(currentAction.viewedTime.length != 0){
                averageVictimPostViewTime = averageVictimPostViewTime / currentAction.viewedTime.length;
                mlm[namePrefix + "VictimPost_AvgViewTime"] = averageVictimPostViewTime;
              }
              //info about the bully comment, report correct comment based on ambig/unambig bully group
              //for(var j = currentAction.comments.length - 1; j >= 0; j--){

              for(var j = 0; j <= (currentAction.comments.length - 1); j++){

                //shortcut to get current comment
                currentComment = currentAction.comments[j];

                //get the comment id for normal Comments data label
                var otherCommentID = 0;

                if(currentComment.comment == otherComment229){
                  otherCommentID = 229;
                }else if (currentComment.comment == otherComment263){
                  otherCommentID = 263;
                } else if (currentComment.comment == otherComment150){
                  otherCommentID = 150;
                } else if (currentComment.comment == otherComment310){
                  otherCommentID = 310;
                } else {
                  otherCommentID = 0;
                }

                if(!currentComment.new_commment){ //safeguard - everything will break if you try to query the comment id of a user comment
                  //only want to show data for the correct case, ambig or unambig
                  if(users[i].bully_group === "ambig"){
                    if((currentComment.comment == day1FlaggedCommentAmbig) || (currentComment.comment == day1NotFlaggedComment) || (currentComment.comment == day2FlaggedCommentAmbig) || (currentComment.comment == day2NotFlaggedComment)){
                      //this is a bully comment that we want all the data for
                      mlm[namePrefix+"BullyComment_Liked"] = +currentComment.liked;
                      mlm[namePrefix +"BullyComment_TimesLiked"] = currentComment.likeTime.length;
                      if(currentComment.likeTime.length > 0){
                        mlm[namePrefix +"BullyComment_LastLikeTime"] = currentComment.likeTime[currentComment.likeTime.length -1];
                      }
                      mlm[namePrefix+"BullyComment_Flagged"] = +currentComment.flagged;
                      if(currentComment.flagTime.length > 0){
                        mlm[namePrefix +"BullyComment_LastFlagTime"] = currentComment.flagTime[currentComment.flagTime.length -1];
                      }
                    } else { //this is a normal comment that we want only half the data for
                      if(otherCommentID !== 0){
                        mlm[namePrefix+"OtherComment"+otherCommentID+"_Liked"] = +currentComment.liked;
                        mlm[namePrefix+"OtherComment"+otherCommentID+"_TimesLiked"] = currentComment.likeTime.length;
                        mlm[namePrefix+"OtherComment"+otherCommentID+"_Flagged"] = +currentComment.flagged;
                      }
                    }
                  } else if (users[i].bully_group === "unambig"){
                    if((currentComment.comment == day1FlaggedCommentUnambig) || (currentComment.comment == day1NotFlaggedComment) || (currentComment.comment == day2FlaggedCommentUnambig) || (currentComment.comment == day2NotFlaggedComment)){
                      //this is a bully comment that we want all the data for
                      mlm[namePrefix+"BullyComment_Liked"] = +currentComment.liked;
                      mlm[namePrefix +"BullyComment_TimesLiked"] = currentComment.likeTime.length;
                      if(currentComment.likeTime.length > 0){
                        mlm[namePrefix +"BullyComment_LastLikeTime"] = currentComment.likeTime[currentComment.likeTime.length -1];
                      }
                      mlm[namePrefix+"BullyComment_Flagged"] = +currentComment.flagged;
                      if(currentComment.flagTime.length > 0){
                        mlm[namePrefix +"BullyComment_LastFlagTime"] = currentComment.flagTime[currentComment.flagTime.length -1];
                      }
                    } else { //this is a normal comment that we only want half the data for
                      if(otherCommentID !== 0){
                        mlm[namePrefix+"OtherComment"+otherCommentID+"_Liked"] = +currentComment.liked;
                        mlm[namePrefix+"OtherComment"+otherCommentID+"_TimesLiked"] = currentComment.likeTime.length;
                        mlm[namePrefix+"OtherComment"+otherCommentID+"_Flagged"] = +currentComment.flagged;
                      }
                    }
                  }
                }
              }
            }
          }
          //done exporting info about special posts!

          //console.log(util.inspect(users[i].feedAction[k], false, null))
          if(users[i].feedAction[k].post == null)
          {
            //console.log("@$@$@$@$@ action ID NOT FOUND: "+users[i].feedAction[k].id);
          }

          //not a bully message
          else
          {
            //getting general like and flag counts, this counts the relevant posts and comments as well

            var currentActionNormal = users[i].feedAction[k];

            //total number of likes
            if(users[i].feedAction[k].liked)
            {
              mlm.GeneralLikeNumber++;
              mlm.GeneralPostLikes++;
            }

            //total number of flags
            if(users[i].feedAction[k].flagTime[0])
            {
              mlm.GeneralFlagNumber++;
              mlm.GeneralPostFlags++;
            }

            //also need to count likes and flags on comments, so iterate through the comments
            for(var n = 0; n <= (currentActionNormal.comments.length - 1); n++){
              currentComment = currentActionNormal.comments[n];
              //console.log(currentComment);
              if(currentComment.liked){
                mlm.GeneralLikeNumber++;
                mlm.GeneralCommentLikes++;
              }
              if(currentComment.flagged){
                mlm.GeneralFlagNumber++;
                mlm.GeneralCommentFlags++;
              }
            }
          }


        }//end of Per FeedAction

      //mlm.GeneralReplyNumber = users[i].numReplies + 1;

      summary_writer.write(sums);
      mlm_writer.write(mlm);
      //s_writer.write(sur);


    }//for each user

    /*
    for (var zz = 0; zz < mlm_array.length; zz++) {
      //console.log("writing user "+ mlm_array[zz].email);
      //console.log("writing Bully Post "+ mlm_array[zz].BullyingPost);
      mlm_writer.write(mlm_array[zz]);
    }
    */
    console.log("Post Table should be "+ sur_array.length);
      for (var zz = 0; zz < sur_array.length; zz++) {
      //console.log("writing user "+ mlm_array[zz].email);
      console.log("writing Post for user "+ zz);
      //s_writer.write(sur_array[zz]);
    }

    mlm_writer.end();
    summary_writer.end();
    //s_writer.end();
    console.log('Wrote MLM!');
    mongoose.connection.close();

  });
