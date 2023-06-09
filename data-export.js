const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const Script = require('./models/Script.js');
const User = require('./models/User.js');
const Actor = require('./models/Actor.js');

const mongoose = require('mongoose');
mongoose.connect(process.env.PRO_MONGODB_URI, { useNewUrlParser: true });
// listen for errors after establishing initial connection
db = mongoose.connection;
db.on('error', (err) => {
    console.error(err);
    console.log(color_error, '%s MongoDB connection error.');
    process.exit(1);
});

const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Console.log color shortcuts
const color_start = '\x1b[33m%s\x1b[0m'; // yellow
const color_success = '\x1b[32m%s\x1b[0m'; // green
const color_error = '\x1b[31m%s\x1b[0m'; // red

/*
  Gets the user models from the database, or folder of json files.
*/
async function getUserJsons() {
    if (isResearchVersion) {
        // establish initial Mongoose connection, if Research Site
        mongoose.connect(process.env.PRO_MONGODB_URI, { useNewUrlParser: true });
        // listen for errors after establishing initial connection
        db = mongoose.connection;
        db.on('error', (err) => {
            console.error(err);
            console.log(color_error, '%s MongoDB connection error.');
            process.exit(1);
        });
        console.log(color_success, `Successfully connected to db.`);
        const users = await User.find({ isStudent: true }).exec();
        console.log(color_success, `...Finished reading from the db.`);
        return users;
    } else {
        let users = [];
        // Read the command inputs
        const myArgs = process.argv.slice(2);
        const directory = myArgs[0];
        console.log(color_start, `Reading all .json files from folder ${directory}`);

        for (filename of fs.readdirSync(directory)) {
            // if filename ends in '.json'
            if (/(\w*)\.json$/gmi.test(filename)) {
                const path = directory + "/" + filename;
                let readFilePromise = function(filePath) {
                    return new Promise((resolve, reject) => {
                        fs.readFile(filePath, 'utf8', (err, data) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(data);
                        })
                    })
                }
                const JsonBuffer = await readFilePromise(path).then(function(data) {
                    return data;
                });
                const lines = JsonBuffer.split(/\n/);
                lines.forEach(function(line) {
                    if (line.trim() == "") {
                        return;
                    }
                    try {
                        users.push(JSON.parse(line));
                    } catch (err) {
                        console.log(err);
                    }
                })
            }
        }
        console.log(color_success, `...Finished reading all files.`)
        return users;
    }
}

/*
  Finds the name of the class this user belongs to via their class access code.
*/
async function getClassNameForUser(user) {
    const classObject = await Class.findOne({ accessCode: user.accessCode }).exec();
    const className = classObject.className;
    return className;
};

/*
  Gets the data from the provided .json file.
  Helper function for:
  - getSectionInformation(user, module_name), 
  - getrec_act_GACounts(user, module_name),
  - getrec_act_FPCounts(user, module_name),
  - getReflectionCheckboxAnswers(user, module_name)
  (Copied this function from the user controller).
*/
async function getJsonFromFile(filePath) {
    let readFilePromise = function(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(data);
            })
        })
    }
    const JsonBuffer = await readFilePromise(filePath).then(function(data) {
        return data;
    });
    let Json;
    try {
        Json = JSON.parse(JsonBuffer);
    } catch (err) {
        return next(err);
    }
    return Json;
}

/*
  Returns if the module has reflection questions of that type (True/False Boolean)
*/
async function hasReflectionType(module_name, type) {
    const reflectionSectionData = await getJsonFromFile("./TD-jsons/reflectionSectionData.json");
    let hasType = false;
    for (const questionNumber in reflectionSectionData[module_name]) {
        if (reflectionSectionData[module_name][questionNumber].type === type) {
            hasType = true;
            break;
        }
    }
    return hasType;
}

/*
  Compare function used to sort pageLog by increasing time. Used as a parameter
  for Array.prototype.sort(). Read about compare functions here:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
*/
function compareTimestamps(a, b) {
    if (a.time < b.time) {
        return -1;
    }
    if (a.time > b.time) {
        return 1;
    }
    return 0;
};

/*
  Calculates the amount of time spent by the user in each section of a module.
  This is calculated by taking the difference between timestamps of sequential
  page visits. Page visits are recorded in the pageLog field.
  Assumptions:
    - pageLog is already sorted in order of increasing timestamps.
    - Final reported times are in seconds.
    - Values are rounded to the nearest integer using Math.round() at the end of
      the calcuation.
    - Sections are defined the same way as the progress bar, using
      progressDataA.json and progressDataB.json.
  Parameters:
    - sectionInformation: Object - this is modified by this function, and will
        contain the final calculations.
    - sectionJson: Object - used to match pages to their corresponding sections.
    - pageLog: [Object] - list of page visits by this user, sorted by time order.
    - module_name: String - the module name to filter by.
  Returns:
    This function does not return anything.
    This function modifies the sectionInformation parameter.
*/
function calculateAndModifyTimeSpent(sectionInformation, sectionJson, pageLog, module_name) {
    for (let i = 0, l = pageLog.length - 1; i < l; i++) {
        // Skip page visits that were not within the specified module.
        if (isResearchVersion) {
            if ((!pageLog[i].subdirectory2) || (pageLog[i].subdirectory2 !== module_name)) {
                continue;
            }
        }
        // Get the time spent on this page by taking the difference between the
        // next recorded page visit.
        let timeDurationOnPage = (isResearchVersion) ?
            (pageLog[i + 1].time - pageLog[i].time) :
            new Date(pageLog[i + 1].time['$date']) - new Date(pageLog[i].time['$date']);
        // Only include times that are shorter than 30 minutes (1800000 milliseconds).
        if (timeDurationOnPage > 1800000) {
            continue;
        }
        // Add the page time to the appropriate section's total time.
        const sectionNumber = sectionJson[pageLog[i].subdirectory1];
        if (sectionNumber === "1") {
            sectionInformation.timeSpent.tt += timeDurationOnPage;
        } else if (sectionNumber === "2") {
            sectionInformation.timeSpent.ga += timeDurationOnPage;
        } else if (sectionNumber === "3") {
            sectionInformation.timeSpent.fp += timeDurationOnPage;
        } else if (sectionNumber === "4") {
            sectionInformation.timeSpent.rf += timeDurationOnPage;
        } else {
            continue;
        }
    }
    // Convert each number from milliseconds to seconds, and round the final
    // number to the nearest integer with Math.round().
    for (const section in sectionInformation.timeSpent) {
        const sectionTimeInSeconds = sectionInformation.timeSpent[section] / 1000;
        sectionInformation.timeSpent[section] = Math.round(sectionTimeInSeconds);
    }
}

/*
  Calculates the frequency that the user jumps between various module sections.
  A jump is identified by comparing each pageLog entry's section number with
  it's previous adjacent entry section number.
  Assumptions:
    - pageLog is already sorted in order of increasing timestamps.
    - Sections are defined the same way as the progress bar, using
      progressDataA.json and progressDataB.json.
  Note: 
    - In the research site, the module progress bar is disabled. Therefore, 
    the user is unable to intuitively jump between various module sections within 
    the application. The only ways the user is able to is by 1) clicking the 
    browser back/forward button [which will most likely be calculated as sequential section
    jumps, even if it's not the user's intent] or 2) inputting the URL browser path.
  Parameters:
    - sectionInformation: Object - this is modified by this function, and will
        contain the final calculations.
    - sectionJson: Object - used to match pages to their corresponding sections.
    - pageLog: [Object] - list of page visits by this user, sorted by time order.
    - module_name: String - the module name to filter by.
  Returns:
    This function does not return anything.
    This function modifies the sectionInformation parameter.
*/
function calculateAndModifyJumpFrequency(sectionInformation, sectionJson, pageLog, module_name) {
    if (pageLog.length < 2) {
        return;
    }
    for (let i = 1, l = pageLog.length - 1; i < l; i++) {
        // Skip page visits that were not within the specified module.
        if (isResearchVersion) {
            if ((!pageLog[i].subdirectory2) || (pageLog[i].subdirectory2 !== module_name)) {
                continue;
            }
            if ((!pageLog[i - 1].subdirectory2) || (pageLog[i - 1].subdirectory2 !== module_name)) {
                continue;
            }
        }
        // Determine if this page sequence matches any of the predefined jump types.
        for (const jumpType in sectionInformation.jumpFrequency) {
            const fromSectionToCompare = sectionJson[pageLog[i - 1].subdirectory1];
            const toSectionToCompare = sectionJson[pageLog[i].subdirectory1];
            if (
                fromSectionToCompare === sectionInformation.jumpFrequency[jumpType].fromSection &&
                toSectionToCompare === sectionInformation.jumpFrequency[jumpType].toSection
            ) {
                // This page sequence matches the current jump type. Increment its count.
                if (module_name === "privacy" && pageLog[i - 1].subdirectory1 === "sim2" & pageLog[i].subdirectory1 === "tutorial") {
                    continue;
                }
                sectionInformation.jumpFrequency[jumpType].count++;
            }
        }
    }
};

/*
  Calculates key information relating to page sections: the time spent in each
  section, as well as the frequency of jumps between certain sections.
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - sectionInformation: Object - object with properties representing the time
        spent (in seconds) in each section of the module, and the frequency
        of jumps betwen various sections in the module.
*/
async function getSectionInformation(user, module_name) {
    const sectionInformation = {
        timeSpent: {
            tt: 0, // The time a learner spent on the tutorial (tt) section
            ga: 0, // The time a learner spent on the guided activity (ga) section
            fp: 0, // The time a learner spent on the freeplay (fp) section
            rf: 0, // The time a learner spent on the reflection (rf) section
        },
        jumpFrequency: {
            ga_to_tt: {
                count: 0, // Frequency of jumping from the ga section to the tt section
                fromSection: '2',
                toSection: '1'
            },
            fp_to_tt: {
                count: 0, // Frequency of jumping from the fp section to the tt section
                fromSection: '3',
                toSection: '1'
            },
            rf_to_tt: {
                count: 0, // Frequency of jumping from the rf section to the tt section
                fromSection: '4',
                toSection: '1'
            },
            fp_to_ga: {
                count: 0, // Frequency of jumping from the fp section to the ga section
                fromSection: '3',
                toSection: '2'
            },
            rf_to_ga: {
                count: 0, // Frequency of jumping from the rf section to the ga section
                fromSection: '4',
                toSection: '2'
            },
            rf_to_fp: {
                count: 0, // Frequency of jumping from the rf section to the fp section
                fromSection: '4',
                toSection: '3'
            }
        }
    };
    const pageLog = user.pageLog;
    // Need to get the mappings between module pages and section numbers.
    const sectionDataA = await getJsonFromFile("./TD-jsons/progressDataA.json");
    const sectionDataB = await getJsonFromFile("./TD-jsons/progressDataB.json");
    /* Short example of the data in progressDataA and progressDataB:
      {
        "start": "1",
        "sim": "2",
        "trans_script": "3",
        "modual": "3",
        "results": "4",
        "quiz": "4",
        "end": "end"
      }
      where the key corresponds to page name, value corresponds to a section number
      1 = "tutorial" section
      2 = "guided activity" section
      3 = "freeplay" section
      4 = "reflection" section
    */
    // Select the corresponding sectionData, A or B, to use depending on the module.
    let sectionJson = new Object();
    switch (module_name) {
        case 'cyberbullying':
        case 'digfoot':
            sectionJson = sectionDataB;
            break;
        default:
            sectionJson = sectionDataA;
            break;
    }
    // Sort the pageLog array by increasing time.
    pageLog.sort(compareTimestamps);
    // Calculate data and modify sectionInformation.
    calculateAndModifyTimeSpent(sectionInformation, sectionJson, pageLog, module_name);
    calculateAndModifyJumpFrequency(sectionInformation, sectionJson, pageLog, module_name);
    return sectionInformation;
};

/*
  Determines the counts of various freeplay (FP) section actions by a single research
  participant within a module.
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - activityCounts: Object - object with properties representing action counts.
*/
function getActivityCountsFP(user, module_name) {
    const freeplayActions = user.feedAction;
    const activityCounts = {
        likeCount: 0, // Number of posts this user liked in the FP section
        flagCount: 0, // Number of posts this user flagged in the FP section
        commentCount: 0 // Number of posts this user commented on in the FP section
    };
    for (const post of freeplayActions) {
        // Skip actions on posts that are not from the specified module_name.
        if (isResearchVersion) {
            if (post.modual !== module_name) {
                continue;
            }
        }
        // Increment likeCount if the user liked this post.
        if (post.liked) {
            activityCounts.likeCount++;
        }
        // Increment flagCount if the user flagged this post.
        if (post.flagged) {
            activityCounts.flagCount++;
        }
        // Iterate through the comment-type actions to find any user-created comments
        if (post.comments) {
            activityCounts.commentCount += post.comments.filter(el => el.new_comment).length;
        }
    }
    return activityCounts;
};

/*
  Determines the counts of reflection questions attempted by a single research
  participant within a module.
  What is considered an attempt?
  open-ended question: the response is not an empty string.
  checkbox: at least once box has been checked.
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - reflectionAttemptCounts: Object - object with properties representing attempt counts.
*/
async function getReflectionAttemptCounts(user, module_name) {
    const hasCheckboxType = await hasReflectionType(module_name, "checkbox");
    const hasWrittenType = await hasReflectionType(module_name, "written");
    const hasRadioType = await hasReflectionType(module_name, "radio");
    const reflectionAttemptCounts = {
        checkbox_rf: (hasCheckboxType) ? 0 : "",
        open_ended_rf: (hasWrittenType) ? 0 : "",
        radio_rf: (hasRadioType ? 0 : "")
    };
    /*
      In the event where a user has completed the reflection section twice (which
      would not be typical), we only want to increment the counts once per
      question.
      Ex. A user answers open-ended question 1 three times.
      One attempt where the question is blank, and the other 2 attemps have inputs.
      In this case, open_ended_rf should be incremented once.
      reflectionAttemptHistory keeps track of when questions already have a
      counted attempt from this user.
    */

    let mostRecentAttempt;
    if (isResearchVersion) {
        // Skip responses on questions that are not from the specified module_name.
        const module_ReflectionAction = user.reflectionAction.filter(reflectionAction => reflectionAction.modual === module_name);
        mostRecentAttempt = module_ReflectionAction[module_ReflectionAction.length - 1];
    } else {
        if (user.reflectionAnswers) {
            mostRecentAttempt = user.reflectionAnswers[user.reflectionAnswers.length - 1];
        } else {
            mostRecentAttempt = user.reflectionAction[user.reflectionAction.length - 1];
        }
    }

    if (!mostRecentAttempt) {
        return reflectionAttemptCounts;
    }
    for (const reflectionResponse of mostRecentAttempt.answers) {
        const questionNumber = reflectionResponse.questionNumber;
        switch (reflectionResponse.type) {
            case 'written':
                {
                    // Any non-empty string counts as an attempt.
                    if (reflectionResponse.writtenResponse.trim() !== '') {
                        reflectionAttemptCounts.open_ended_rf++;
                    }
                    break;
                }
            case 'habitsUnique':
                {
                    // Any non-empty string counts as an attempt.
                    if (reflectionResponse.writtenResponse.trim() !== '') {
                        reflectionAttemptCounts.open_ended_rf++;
                    }
                    break;
                }
            case 'checkbox':
                {
                    // Minimum of one checkbox must be selelected to count as an attempt.
                    if (reflectionResponse.checkboxResponse > 0) {
                        reflectionAttemptCounts.checkbox_rf++;
                    }
                    break;
                }
            case 'radio':
                {
                    // Must select a radio selection to count as an attempt.
                    if (reflectionResponse.radioSelection) {
                        reflectionAttemptCounts.radio_rf++;
                    }
                    break;
                }
            default:
                {
                    // There shouldn't be any other reflection response types. Log if there is.
                    console.log(color_error, `WARNING: There was an unexpected reflection response type for ${questionNumber} in module ${module_name}: type ${reflectionResponse.type}`);
                    break;
                }
        }
    }
    return reflectionAttemptCounts;
}

/*
  Determines the number of times the user clicks the “back” button on the text bubbles 
  on the tutorial pages of a given module.
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - backTTCounts: Integer - the number of times the "back" button is clicked
*/
function getback_TTCounts(user, module_name) {
    let introjsStepActions;

    /* Example of introjsStepAction 
      subdirectory1: String, // which page the user is on
      subdirectory2: String, // which module the user is on
      stepNumber: Number, // which step this action is on (steps start from 0)
      viewDuration: Number, // how long the user was on this step (milliseconds)
      absoluteStartTime: Date // time the step opened in the real world
    */
    if (isResearchVersion) {
        introjsStepActions = introjsStepActions.filter(action => action.subdirectory2 === module_name);
    } else {
        introjsStepActions = user.introjsStepAction;
    }
    const moduleTutorialStepActions = introjsStepActions.filter(action => action.subdirectory1 === 'tutorial');

    let index = -1;
    let backTTCounts = 0;

    for (const step of moduleTutorialStepActions) {
        if (step.stepNumber < index) {
            backTTCounts++;
        }
        index = step.stepNumber;
    }
    return backTTCounts;
};

/*
  Determines the number of "1"s in number n (in binary representation)
  Helper function for getrec_act_GACounts(), getrec_act_FPCounts(), and getReflectionCheckboxAnswers().
*/
function countSetBits(n) {
    var count = 0;
    while (n) {
        count += n & 1;
        n >>= 1;
    }
    return count;
}

/*
  Helper Function: Determines the count of recommended actions the user takes in the Guided Activity section of the 'Accounts and Password' module
*/
function getrec_act_GACounts_accountsModule(user, module_name) {
    // get user's accountsAction
    const gaActions = user.accountsAction;

    var rec_act_GACounts = 0;

    if (gaActions.find(action => action.subdirectory1 === "sim" &&
            action.inputField === "password" && action.passwordStrength !== undefined &&
            (action.passwordStrength === "Strong" || action.passwordStrength === "Very Strong"))) {
        rec_act_GACounts += 1;
    }

    if (gaActions.find(action => action.subdirectory1 === "sim2" && action.inputText === "true")) {
        rec_act_GACounts += 1;
    }
    return rec_act_GACounts;
}
/*
  Helper Function: Determines the count of recommended actions the user takes in the Guided Activity section of the 'Healthy Social Media Habits' module
*/
function getrec_act_GACounts_habitsModule(user, module_name) {
    // get user's habitsAction
    const gaActions = user.habitsAction;

    var rec_act_GACounts = 0;

    if (gaActions.find(action => action.subdirectory1 === "sim3" &&
            (action.actionType === "togglePauseNotifications" || action.actionType === "setPauseNotifications") && action.setValue === "pause")) {
        rec_act_GACounts += 1;
    }
    return rec_act_GACounts;
}
/*
  Helper Function: Determines the count of recommended actions the user takes in the Guided Activity section of the 'Is it Private Information?' module
*/
function getrec_act_GACounts_safePostingModule(user, module_name) {
    // get user's chatAction
    const gaActions = user.chatAction.filter(action => action.subdirectory1 === "sim");
    if (gaActions.length === 0) {
        return 1;
    }

    var rec_act_GACounts = 0;
    if (gaActions.find(action => action.chatId === "chatbox1" && action.messages.length === 0)) {
        rec_act_GACounts += 1;
        return rec_act_GACounts;
    }
    if (gaActions.find(action => action.chatId === "chatbox1" && action.messages.length === 1 && (action.minimized || action.closed))) {
        rec_act_GACounts += 1;
        return rec_act_GACounts;
    }
    return rec_act_GACounts;
}
/*
  Helper Function: Determines the count of recommended actions the user takes in the Guided Activity section of the 'Social Media Privacy' module
*/
function getrec_act_GACounts_privacyModule(user, module_name) {
    // get user's chatAction
    const gaActions = user.privacyAction.filter(action => action.subdirectory1 === "sim");
    var rec_act_GACounts = 0;
    if (gaActions.find(action => action.inputField === "isPrivate" && action.inputText === "true")) {
        rec_act_GACounts += 1;
    }
    if (gaActions.find(action => action.inputField === "friendRequests" && action.inputText === "Friends of Friends")) {
        rec_act_GACounts += 1;
    }
    if (gaActions.find(action => action.inputField === "shareLocation" && action.inputText === "false")) {
        rec_act_GACounts += 1;
    }
    if (gaActions.find(action => action.inputField === "shareLocationWith" && action.inputText !== "Everyone")) {
        rec_act_GACounts += 1;
    }
    return rec_act_GACounts;
}

/*
  Determines the count of recommended actions the user takes in the Guided Activity section of a module
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - rec_act_GACounts: Integer - the number of recommended actions taken by the user in the GA section of module
*/
async function getrec_act_GACounts(user, module_name) {
    var rec_act_GACounts = 0;
    if (module_name === "accounts") {
        return getrec_act_GACounts_accountsModule(user, module_name);
    } else if (module_name === "habits") {
        return getrec_act_GACounts_habitsModule(user, module_name);
    } else if (module_name === "safe-posting") {
        rec_act_GACounts += getrec_act_GACounts_safePostingModule(user, module_name);
    } else if (module_name === "presentation") {
        return;
    } else if (module_name === "privacy") {
        return getrec_act_GACounts_privacyModule(user, module_name);
    }
    // get module recommended actions
    const recActions = await getJsonFromFile("./TD-jsons/guidedActivityRecActions.json");
    // get user's guidedActivityActions (list of guidedActivityAction objects)
    const gaActions = user.guidedActivityAction;

    /* Example of guidedActivityAction
      post: String, // Which post did the user interact with? ex: "cyberbullying_sim_post1"
      modual: String, // which lesson mod did this take place in?
      startTime: 0, // (not used in TestDrive)
      liked: {type: Boolean, default: false}, // did the user like this post in the feed?
      flagged: {type: Boolean, default: false}, // did the user flag this post in the feed?
      flagTime  : [Date], // list of timestamps when the user flagged the post
      likeTime  : [Date], //list of timestamps when the user liked the post
      replyTime  : [Date], // list of timestamps when the user left a comment on the post

      // popup modal info: one per open
      modal: [new Schema({
        modalName: String, // name of Modal
        modalOpened: {type: Boolean, default: false}, // did the user open the modal?
        modalOpenedTime: Number, // timestamp the user opened the modal
        modalViewTime: Number, // Duration of time that the modal was open (in milliseconds)
        modalCheckboxesCount: Number, // How many checkboxes are present in the modal
        modalCheckboxesInput: Number, // Number which, when converted into binary format, corresponds to which checkboxes were checked
        modalDropdownCount: Number, // How many accordion dropdown triangles are present in the modal
        modalDropdownClick: Number, // Number which, when converted into a binary format, corresponds to which triangles were clicked
      }

      // comment info on an actor's post (fake post): one per comment
      comments: [new Schema({
        comment: String, // Which comment did the user interact with? ex: "cyberbullying_sim_post1_comment1"
        liked: {type: Boolean, default: false}, // Is the comment liked ?
        flagged: {type: Boolean, default: false}, // Is the comment flagged?
        flagTime  : [Date], // list of timestamps when the user flagged the comment
        likeTime  : [Date], // list of timestamps when the user liked the comment

        new_comment: {type: Boolean, default: false}, // Is this a new comment?
        new_comment_id: String, // Number, starting at 0, used to ID user-made comments (starts at 0)
        comment_body: String, // Text of comment
        absTime: Date, // Real-life timestamp of when the comment was made
      }
    */

    const module_recActions = recActions[module_name]; // recommended actions that should be taken in the module
    const module_gaActions = (isResearchVersion) ? gaActions.filter(action => action.modual === module_name) : gaActions; // user's actions taken in module

    // loop through each post. For each post, check if user completes the recommended actions for that post
    for (var postID in module_recActions) {
        if (module_recActions.hasOwnProperty(postID)) {
            // get recommended actions for the post
            const post_recAction = module_recActions[postID];
            // find corresponding post in user's actions
            const post_gaAction = module_gaActions.find(action => action.post === postID);

            if (post_gaAction === undefined) { // User did not conduct any actions on the post
                continue;
            }

            // Checks to see if user left a comment on the post
            if (post_recAction["commentOnPost"]) {
                for (const commentObj of post_gaAction["comments"]) {
                    if (commentObj["new_comment"]) { // code currently already doesn't allow a comment without text to be logged
                        rec_act_GACounts += 1;
                        break; // only count 1 comment
                    }
                }
            }

            // Checks to see if user flagged the post
            if (post_recAction["flagPost"]) {
                rec_act_GACounts += post_gaAction["flagged"] ? 1 : 0;
            }

            // Checks to see if user flagged comments
            for (const commentID of post_recAction["flagComments"]) {
                const comment = post_gaAction["comments"].find(commentObj => commentObj.comment !== undefined && commentObj.comment === commentID);
                if (comment === undefined) { // User did not conduct any actions on the comment
                    continue;
                }
                rec_act_GACounts += comment["flagged"] ? 1 : 0;
            }

            // Checks to see if user conducted recommended actions on modals
            for (var modalName in post_recAction["modals"]) {
                const modal_recActions = post_recAction["modals"][modalName];

                const modal_gaActions_reverse = post_gaAction["modal"].slice().reverse(); // make copy & reverse, so we consider the most recent open of the modal
                const modal = modal_gaActions_reverse.find(modalObj => modalObj.modalName === modalName);

                if (modal === undefined) { // User did not interact with modal
                    continue;
                }

                for (var action in modal_recActions) {
                    if (action === "modalCheckboxesInput") {
                        const rec_num = parseInt(modal_recActions[action], 2);
                        const ga_num = modal[action];
                        rec_act_GACounts += countSetBits(rec_num & ga_num);
                    } else {
                        rec_act_GACounts += (modal_recActions[action] === modal[action]) ? 1 : 0;
                    }
                }
            }
        }
    }
    return rec_act_GACounts;
};

/*
  Finds the ObjectID of the post
  Parameters: 
    - post_id: Integer (defined in excel during population of database)
  Helper function for getrec_act_FPCounts()
*/
async function getObjectIDForPost(post_id) {
    const scriptObject = await Script.findOne({ post_id: post_id }).exec();
    const script_objectID = scriptObject._id;
    return script_objectID;
};

/*
  Finds the ObjectID of the comment specified on post.
  Parameters: 
    - post_id: Integer (defined in excel during population of database)
    - commentIndex: Integer indicating the number comment on post (ex: 1 = 1st comment on post)
  Helper function for getrec_act_FPCounts()
*/
async function getObjectIDForComment(post_id, commentIndex) {
    const scriptObject = await Script.findOne({ post_id: post_id }).exec();
    const comment_objectID = scriptObject.comments[commentIndex - 1]._id;
    return comment_objectID;
}

/*
  Helper Function: Determines the count of recommended actions the user takes in the Free Play section of the 'Healthy Social Media Habits' module
*/
function getrec_act_FPCounts_habitsModule(user, module_name) {
    // get user's accountsAction
    const fpActions = user.habitsAction;

    var rec_act_FPCounts = 0;

    if (fpActions.find(action => action.subdirectory1 === "modual" && action.actionType === "clickSettingsTab")) {
        rec_act_FPCounts += 1;
    }

    if (fpActions.find(action => action.subdirectory1 === "modual" && action.actionType === "clickMyActivityTab")) {
        rec_act_FPCounts += 1;
    }

    if (fpActions.find(action => action.subdirectory1 === "modual" &&
            (action.actionType === "togglePauseNotifications" || action.actionType === "setPauseNotifications") && action.setValue === "pause")) {
        rec_act_FPCounts += 1;
    }

    if (fpActions.find(action => action.subdirectory1 === "modual" && action.actionType === "setDailyReminder")) {
        rec_act_FPCounts += 1;
    }
    return rec_act_FPCounts;
}
/*
  Helper Function: Determines the count of recommended actions the user takes in the Guided Activity section of the 'Is it Private Information?' module
*/
function getrec_act_FPCounts_safePostingModule(user, module_name) {
    // get user's chatAction
    const fpActions = user.chatAction.filter(action => action.subdirectory1 === "modual");
    if (fpActions.length === 0) {
        return 2;
    }

    var rec_act_FPCounts = 0;
    const chatboxes = ["chatbox1", "chatbox2"]
    for (const chatID of chatboxes) {
        if (!fpActions.find(action => action.chatId === chatID)) {
            rec_act_FPCounts += 1;
            continue;
        }
        if (fpActions.find(action => action.chatId === chatID && action.messages.length === 0)) {
            rec_act_FPCounts += 1;
            continue;
        }
        if (fpActions.find(action => action.chatId === chatID && action.messages.length === 1 && (action.minimized || action.closed))) {
            rec_act_FPCounts += 1;
            continue;
        }
    }
    return rec_act_FPCounts;
}
/*
  Determines the count of recommended actions the user takes in the FreePlay Activity section of a module
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - rec_act_FPCounts: Integer - the number of recommended actions taken by the user in the FP section of module
*/
async function getrec_act_FPCounts(user, module_name) {
    var rec_act_FPCounts = 0;
    if (module_name === "accounts" || module_name === "privacy") {
        return;
    } else if (module_name === "habits") {
        return getrec_act_FPCounts_habitsModule(user, module_name);
    } else if (module_name === "safe-posting") {
        rec_act_FPCounts += await getrec_act_FPCounts_safePostingModule(user, module_name);
    } else if (module_name === "presentation") {
        const userPosts = (isResearchVersion) ? user.posts.filter(post => post.module === "presentation") : user.posts;
        return userPosts.length;
    }
    // get module recommended actions
    const recActions = await getJsonFromFile("./TD-jsons/freeplayActivityRecActions.json");
    // get user's freeplay section Actions (list of feedAction objects)
    const fpActions = user.feedAction;

    /* Example of feedAction
      post: ObjectID, // Which post did the user interact with? 
      modual: String, // which lesson mod did this take place in?
      startTime: 0, // (not used in TestDrive)
      liked: {type: Boolean, default: false}, // did the user like this post in the feed?
      flagged: {type: Boolean, default: false}, // did the user flag this post in the feed?
      flagTime  : [Date], // list of timestamps when the user flagged the post
      likeTime  : [Date], //list of timestamps when the user liked the post
      replyTime  : [Date], // list of timestamps when the user left a comment on the post

      // popup modal info: one per open
      modal: [new Schema({
        modalName: String, // name of Modal
        modalOpened: {type: Boolean, default: false}, // did the user open the modal?
        modalOpenedTime: Number, // timestamp the user opened the modal
        modalViewTime: Number, // Duration of time that the modal was open (in milliseconds)
        modalCheckboxesCount: Number, // How many checkboxes are present in the modal
        modalCheckboxesInput: Number, // Number which, when converted into binary format, corresponds to which checkboxes were checked
        modalDropdownCount: Number, // How many accordion dropdown triangles are present in the modal
        modalDropdownClick: Number, // Number which, when converted into a binary format, corresponds to which triangles were clicked
      }

      // comment info on an actor's post (fake post): one per comment
      comments: [new Schema({
        comment: ObjectID, // Which comment did the user interact with? 
        liked: {type: Boolean, default: false}, // Is the comment liked ?
        flagged: {type: Boolean, default: false}, // Is the comment flagged?
        flagTime  : [Date], // list of timestamps when the user flagged the comment
        likeTime  : [Date], // list of timestamps when the user liked the comment

        new_comment: {type: Boolean, default: false}, // Is this a new comment?
        new_comment_id: String, // Number, starting at 0, used to ID user-made comments (starts at 0)
        comment_body: String, // Text of comment
        absTime: Date, // Real-life timestamp of when the comment was made
      }
    */

    const module_recActions = recActions[module_name]; // recommended actions that should be taken in the module
    const module_fpActions = (isResearchVersion) ? fpActions.filter(action => action.modual === module_name) : fpActions; // user's actions taken in module

    // loop through each post. For each post, check if user completes the recommended actions for that post
    for (var post_id in module_recActions) {
        if (module_recActions.hasOwnProperty(post_id)) {
            // get recommended actions for the post
            const post_recAction = module_recActions[post_id];

            // If module is 'targeted', 'esteem' (customized module), only consider the posts that match the latest chosen topic
            // Why? For special case: generally speaking, the student can only complete each module once, but in case a student uses the browser back buttons to change their topic
            if (module_name === "esteem" || module_name === "targeted") {
                if (isResearchVersion) {
                    customTopic = (module_name === "targeted") ? user.targetedAdTopic[user.targetedAdTopic.length - 1] : user.esteemTopic[user.esteemTopic.length - 1];
                } else {
                    customTopic = user.chosenTopic[user.chosenTopic.length - 1]
                }

                if (post_recAction["topic"] !== customTopic) {
                    continue;
                }
            }

            // find corresponding post in user's actions
            let post_fpAction;
            if (isResearchVersion) {
                const post_ObjectID = await getObjectIDForPost(post_id);
                post_fpAction = module_fpActions.find(action => action.post.equals(post_ObjectID));
            } else {
                // post_fpAction = module_fpActions.find(action => action.postID_num === parseInt(post_id));
                const post_ObjectID = await getObjectIDForPost(post_id);
                post_fpAction = module_fpActions.find(action => {
                    if (action.postID === undefined) {
                        return false;
                    }
                    const postID = new mongoose.mongo.ObjectId(action.postID['$oid']);
                    return postID.equals(post_ObjectID);
                });
            }
            if (post_fpAction === undefined) { // User did not conduct any actions on the post
                continue;
            }
            // Checks to see if user left a comment on the post
            if (post_recAction["commentOnPost"]) {
                for (const commentObj of post_fpAction["comments"]) {
                    if (commentObj["new_comment"]) { // code currently already doesn't allow a comment without text to be logged
                        rec_act_FPCounts += 1;
                        break; // only count 1 comment
                    }
                }
            }

            // Checks to see if user flagged the post
            if (post_recAction["flagPost"]) {
                rec_act_FPCounts += post_fpAction["flagged"] ? 1 : 0;
            }

            // Checks to see if user flagged comments
            for (const commentIndex of post_recAction["flagComments"]) {
                let comment;
                if (isResearchVersion) {
                    const comment_ObjectID = await getObjectIDForComment(post_id, commentIndex);
                    comment = post_fpAction["comments"].find(commentObj => commentObj.comment !== undefined && commentObj.comment.equals(comment_ObjectID));
                } else {
                    // comment = post_fpAction["comments"].find(commentObj => commentObj.comment !== undefined && commentObj.comment_index === parseInt(commentIndex));
                    const comment_ObjectID = await getObjectIDForComment(post_id, commentIndex);
                    comment = post_fpAction["comments"].find(commentObj => {
                        if (commentObj.comment === undefined) {
                            return false;
                        }
                        const commentID = new mongoose.mongo.ObjectId(commentObj.comment['$oid']);
                        return commentID.equals(comment_ObjectID);
                    });
                }
                if (comment === undefined) { // User did not conduct any actions on the comment
                    continue;
                }
                rec_act_FPCounts += comment["flagged"] ? 1 : 0;
            }

            // Checks to see if user conducted recommended actions on modals
            for (var modalName in post_recAction["modals"]) {
                const modal_recActions = post_recAction["modals"][modalName];

                const modal_fpActions_reverse = post_fpAction["modal"].slice().reverse(); // make copy & reverse, so we consider the most recent open of the modal
                const modal = modal_fpActions_reverse.find(modalObj => modalObj.modalName === modalName);

                if (modal === undefined) { // User did not interact with modal
                    continue;
                }

                for (var action in modal_recActions) {
                    if (action === "modalCheckboxesInput") {
                        const rec_num = parseInt(modal_recActions[action], 2);
                        const fp_num = modal[action];
                        rec_act_FPCounts += countSetBits(rec_num & fp_num);
                    } else {
                        rec_act_FPCounts += (modal_recActions[action] === modal[action]) ? 1 : 0;
                    }
                }
            }
        }
    }

    // only for digital-literacy module: add 1 to count if the user clicks articleInfoModal on any post 
    // (this will include the 3 posts specified, which is why it is not included in the JSON file)
    if (module_name === "digital-literacy") {
        for (post of module_fpActions) {
            const modal = post["modal"].find(modalObj => modalObj.modalName === "digital-literacy_articleInfoModal");

            if (modal !== undefined) {
                rec_act_FPCounts++;
            }
        }
    }
    return rec_act_FPCounts;
};

/*
  Retrieves the (most recent) reflection answers from the user for the checkbox type questions 
  in the module.
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - reflectionCheckboxAnswers: Object - object with properties giving reflection answers in binary form.
    Ex: '0100' is a binary representation of the checkboxes for that question
*/
async function getReflectionCheckboxAnswers(user, module_name) {
    const hasCheckboxType = await hasReflectionType(module_name, "checkbox");
    const reflectionCheckboxAnswers = {
        Q1: "",
        Q2: "",
        Q3: "",
    };
    let numberCorrect = (hasCheckboxType) ? 0 : "";

    const reflectionSectionData = await getJsonFromFile("./TD-jsons/reflectionSectionData.json");

    /* Example of reflectionAction 
      absoluteTimeContinued: Date, //time that the user left the page by clicking continue
      modual: String, //which lesson mod did this take place in?
      questionNumber: String, // corresponds with reflectionSectionData.json, i.e. 'Q1', 'Q2', 'Q3'...
      prompt: String,
      type: String, // Which type of response this will be: written, checkbox, radio, habitsUnique
      writtenResponse: String,
      radioSelection: String, // this is for the presentation module
      numberOfCheckboxes: Number,
      checkboxResponse: Number,
      checkedActualTime: Boolean, // this is unique to the habits module
    */
    // Skip responses on questions that are not from the specified module_name.
    let mostRecentAttempt;
    if (isResearchVersion) {
        // Skip responses on questions that are not from the specified module_name.
        const module_ReflectionAction = user.reflectionAction.filter(reflectionAction => reflectionAction.modual === module_name);
        mostRecentAttempt = module_ReflectionAction[module_ReflectionAction.length - 1];
    } else {
        if (user.reflectionAnswers) {
            mostRecentAttempt = user.reflectionAnswers[user.reflectionAnswers.length - 1];
        } else {
            mostRecentAttempt = user.reflectionAction[user.reflectionAction.length - 1];
        }
    }

    if (!mostRecentAttempt) {
        return [reflectionCheckboxAnswers, numberCorrect];
    }

    for (const reflectionResponse of mostRecentAttempt.answers) {
        if (reflectionResponse["type"] !== "checkbox") {
            continue;
        }
        const questionNumber = reflectionResponse.questionNumber;
        const question = reflectionSectionData[module_name][questionNumber];
        const checkboxResponse = reflectionResponse["checkboxResponse"].toString(2).padStart(reflectionResponse["numberOfCheckboxes"], '0');

        if (question["type"] === "checkbox") {
            // need to append tab in front, in order for any leading zeros to show up on Excel
            reflectionCheckboxAnswers[questionNumber] = "\t" + checkboxResponse;

            // Check correctness of checkbox answer
            const correctCheckboxResponse = parseInt(Object.values(question["correctResponses"]).join(''), 2);
            numberCorrect += countSetBits(correctCheckboxResponse & reflectionResponse["checkboxResponse"]);
        } else if (question["type"] === "checkboxGrouped") {
            const subquestionLength = reflectionResponse["numberOfCheckboxes"] / question["groupCount"];
            const regex = new RegExp(`.{1,${subquestionLength}}`, 'g'); //splits the string into sections of length subquestionLength
            reflectionCheckboxAnswers[questionNumber] = checkboxResponse.match(regex).join(", ");

            // Check correctness of checkbox answer
            let correctCheckboxResponse = "";
            for (subquestion in question["correctResponses"]) {
                correctCheckboxResponse += Object.values(question["correctResponses"][subquestion]).join('');
            }
            correctCheckboxResponse = parseInt(correctCheckboxResponse, 2);
            numberCorrect += countSetBits(correctCheckboxResponse & reflectionResponse["checkboxResponse"]);
        }
    }
    return [reflectionCheckboxAnswers, numberCorrect];
}

/*
  Calculates key information relating to quiz section: the number of attempts on a quiz, if they 
  checked quiz explanations, and the number of correct answers on each attempt. 
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - quizInformation: Object - object with properties representing the number of attempts on a quiz, if they 
    checked quiz explanations, and the number of correct answers on each attempt. 
*/
function getQuizInformation(user, module_name) {
    const quizInformation = {
        numAttempts: 0,
        checkQuiz: false,
        numCorrect: []
    };

    let module_QuizAction;
    if (isResearchVersion) {
        // Skip responses on questions that are not from the specified module_name.
        module_QuizAction = user.quizAction.filter(quizAction => quizAction.modual === module_name);
        if (!user.viewQuizExplanations.filter(viewQuizExplanation => viewQuizExplanation.module === module_name && click === true)) {
            quizInformation.checkQuiz = true;
        }
    } else {
        if (user.quizAnswers) {
            module_QuizAction = user.quizAnswers;
        } else {
            module_QuizAction = user.quizAction;
        }
        if (user.viewQuizExplanations) {
            quizInformation.checkQuiz = true;
        }
    }
    quizInformation.numAttempts = module_QuizAction.length;
    quizInformation.numCorrect = module_QuizAction.map(quizAction => quizAction.numCorrect);

    return quizInformation;
}

/*
  Calculates the total time the voiceover is turned on. (Note: does not distinguihs between modules.)
  Parameters:
    - user: Object - the user data from one study participant.
    - module_name: String - the module name to filter by.
  Returns:
    - sum: Number - how long the voiceover is turned on for
*/
function getVoiceoverTime(user, module_name) {
    const sum = user.voiceoverTimer.reduce(function(a, b) { return a + b; }, 0);
    const TimeInSeconds = Math.round(sum / 1000);
    return TimeInSeconds;
}

async function getDataExport() {
    const users = await getUserJsons();

    console.log(color_start, `Starting the data export script...`);
    const currentDate = new Date();
    const outputFilename =
        ((!isResearchVersion) ? `calculated-publicTestDrive-dataExport` : `calculated-researchTestDrive-dataExport`) +
        `.${currentDate.getMonth()+1}-${currentDate.getDate()}-${currentDate.getFullYear()}` +
        `.${currentDate.getHours()}-${currentDate.getMinutes()}-${currentDate.getSeconds()}`;
    const outputFilepath = `./${outputFilename}.csv`;
    const csvWriter_header = [
        { id: 'module_name', title: "Module_Name" },
        { id: 'time_spent_tt', title: 'Time_Spent_TT (in seconds)' },
        { id: 'time_spent_ga', title: 'Time_Spent_GA (in seconds)' },
        { id: 'time_spent_fp', title: 'Time_Spent_FP (in seconds)' },
        { id: 'time_spent_rf', title: 'Time_Spent_RF (in seconds)' },
        { id: 'ga_to_tt', title: 'GA_to_TT' },
        { id: 'fp_to_tt', title: 'FP_to_TT' },
        { id: 'rf_to_tt', title: 'RF_to_TT' },
        { id: 'fp_to_ga', title: 'FP_to_GA' },
        { id: 'rf_to_ga', title: 'RF_to_GA' },
        { id: 'rf_to_fp', title: 'RF_to_FP' },
        { id: 'back_tt', title: 'Back_TT' },
        { id: 'rec_act_ga', title: 'Rec_act_GA' },
        { id: 'liked_post_fp', title: 'Liked_post_FP' },
        { id: 'flagged_post_fp', title: 'Flagged_post_FP' },
        { id: 'commented_post_fp', title: 'Commented_post_FP' },
        { id: 'rec_act_fp', title: 'Rec_act_FP' },
        { id: 'checkbox_rf', title: 'Checkbox_RF' },
        { id: 'radio_rf', title: 'Radio_RF' },
        { id: 'open_ended_rf', title: 'Open_ended_ RF' },
        { id: 'habitsTimeCheck_rf', title: 'Habits_Timecheck_RF (unique to Habits module)' },
        { id: 'checkbox_q1', title: 'Checkbox_Q1' },
        { id: 'checkbox_q2', title: 'Checkbox_Q2' },
        { id: 'checkbox_q3', title: 'Checkbox_Q3' },
        { id: 'correct_checkbox_rf', title: 'Num_Correct_Checkbox_RF' },
        { id: 'attempts_quiz', title: 'Num_Attempts_Quiz' },
        { id: 'check_quiz', title: 'Check_Explanations_Quiz' },
        { id: 'correct_quiz_1', title: 'Num_Correct_Quiz_Attempt1' },
        { id: 'correct_quiz_2', title: 'Num_Correct_Quiz_Attempt2' },
        { id: 'correct_quiz_3', title: 'Num_Correct_Quiz_Attempt3' },
        { id: 'voiceover_time', title: 'Voiceover_Time (in seconds)' },
    ]
    if (isResearchVersion) {
        csvWriter_header = csvWriter_header.concat([
            { id: 'class_name', title: 'Class_Name' },
            { id: 'access_code', title: 'Access_Code' },
            { id: 'username', title: 'Username' },
        ])
    }
    const csvWriter = createCsvWriter({
        path: outputFilepath,
        header: csvWriter_header
    });
    const records = [];
    // For each record or student
    for (const user of users) {
        // if (isResearchVersion) {
        //     const accessCode = user.accessCode;
        //     // STUDY ACCESS CODES:
        //     const study_accessCodes = []; // TODO: Add access codes of classes in the study
        //     // only do a data export of students in specified study
        //     if (!study_accessCodes.includes(accessCode)) {
        //         continue;
        //     }
        // }
        if (!user.pageLog) {
            continue;
        }
        const modules = ["cyberbullying", "digfoot", "digital-literacy", "targeted", "phishing", "esteem"];
        if (!modules.includes(user.module)) {
            continue
        }
        // Check if the user has been assigned modules (usually 4 modules total)
        const numOfAssignedModules = (isResearchVersion && user.assignedModules) ? user.assignedModules.length : 12;
        for (let i = 0; i < (isResearchVersion ? numOfAssignedModules : 1); i++) {
            const record = {};

            if (isResearchVersion) {
                record.class_name = await getClassNameForUser(user);
                record.username = user.username;
                record.access_code = user.accessCode
            }

            const assignedModule = (isResearchVersion) ? ((user.assignedModules) ? user.assignedModules[`module${i+1}`] : Object.keys(user.moduleProgress)[i]) : user.module;
            const sectionInformation = await getSectionInformation(user, assignedModule);
            if (assignedModule !== "accounts" && assignedModule !== "privacy") {
                const activityCounts = getActivityCountsFP(user, assignedModule);
                record.liked_post_fp = activityCounts.likeCount;
                record.flagged_post_fp = activityCounts.flagCount;
                record.commented_post_fp = activityCounts.commentCount;
            }
            const reflectionAttemptCounts = await getReflectionAttemptCounts(user, assignedModule);
            const back_TTCounts = getback_TTCounts(user, assignedModule);
            const rec_act_GACounts = await getrec_act_GACounts(user, assignedModule);
            const rec_act_FPCounts = await getrec_act_FPCounts(user, assignedModule);
            const [reflectionCheckboxAnswers, numberCorrect] = await getReflectionCheckboxAnswers(user, assignedModule);
            const quizInformation = getQuizInformation(user, assignedModule);
            const voiceoverTime = getVoiceoverTime(user, assignedModule);

            record.module_name = assignedModule;
            record.time_spent_tt = sectionInformation.timeSpent.tt;
            record.time_spent_ga = sectionInformation.timeSpent.ga;
            record.time_spent_fp = sectionInformation.timeSpent.fp;
            record.time_spent_rf = sectionInformation.timeSpent.rf;
            record.ga_to_tt = sectionInformation.jumpFrequency.ga_to_tt.count;
            record.fp_to_tt = sectionInformation.jumpFrequency.fp_to_tt.count;
            record.rf_to_tt = sectionInformation.jumpFrequency.rf_to_tt.count;
            record.fp_to_ga = sectionInformation.jumpFrequency.fp_to_ga.count;
            record.rf_to_ga = sectionInformation.jumpFrequency.rf_to_ga.count;
            record.rf_to_fp = sectionInformation.jumpFrequency.rf_to_fp.count;
            record.back_tt = back_TTCounts;
            record.rec_act_ga = rec_act_GACounts;
            record.rec_act_fp = rec_act_FPCounts;
            record.checkbox_rf = reflectionAttemptCounts.checkbox_rf;
            record.open_ended_rf = reflectionAttemptCounts.open_ended_rf;
            record.radio_rf = reflectionAttemptCounts.radio_rf;
            record.checkbox_q1 = reflectionCheckboxAnswers.Q1;
            record.checkbox_q2 = reflectionCheckboxAnswers.Q2;
            record.checkbox_q3 = reflectionCheckboxAnswers.Q3;
            record.correct_checkbox_rf = numberCorrect;
            record.attempts_quiz = quizInformation.numAttempts;
            record.check_quiz = quizInformation.checkQuiz;
            record.correct_quiz_1 = quizInformation.numCorrect[0];
            record.correct_quiz_2 = quizInformation.numCorrect[1];
            record.correct_quiz_3 = quizInformation.numCorrect[2];
            record.voiceover_time = voiceoverTime;

            if (assignedModule === "habits") {
                const reflectionAction = user.reflectionAction || user.reflectionAnswers;
                if (reflectionAction[reflectionAction.length - 1]) {
                    record.habitsTimeCheck_rf = reflectionAction[reflectionAction.length - 1]["answers"].find(answer => answer.questionNumber === "Q2")["checkedActualTime"];
                }
            }
            records.push(record);
        }
    }
    await csvWriter.writeRecords(records);
    console.log(color_success, `...Data export completed.\nFile exported to: ${outputFilepath} with ${records.length} records.`);
    // if (isResearchVersion) {
    db.close();
    console.log(color_start, 'Closed db connection.');
    // }
}

getDataExport();