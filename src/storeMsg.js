import fs from "fs";

/** @type {import('@adiwajshing/baileys').WASocket} */
let tempSock;

/** @type {import('./memorystore').MemoryStore} */
let tempStore;

/** @type {{[jid:string]: {"messageID": {reactionsCount: number,minToMute: number, startTime: number}}}}*/
let tempMuteGroup = {};

/** @type {{[jid:string]: {name: string, approvalTermsOfService: boolean, countUsersToMute: number, spam: string, blockLinks: boolean, blockLinksUser: string[], classes: string[], paidGroup: boolean, lastUsedGPT: number, countGPT: number, lastUsedEveryBodyCommand: number}}} */
let tempGroupConfig = {};

/** @type {{[jid:string]: NodeJS.Timeout }} */
let tempTimeouts = {};

/** @type {{omerInternal: NodeJS.Timeout, chats: string[] }} */
let omerReminder = {};

/**  
 * @type {{quizLev: {
 *              groups : {
 *                      "groupID" : {
 *                                  isActive: boolean,
 *                                  hourOfQuiz: number,
 *                                  progress: { ProgrammingQuiz: number, MathQuiz: number, BibleQuiz: number},
 *                                  tempParticipates: { "userID": {timestamp: Number, group: string}},
 *                                  tempAnswer: { type: string, answer: any }
 *                      }, 
 *                      participates : {
 *                                  "userID": { group: string, name: string, score: number } 
 *                      }
 *              }
 *      }}}
 * */
let tempQuizLev = {};

/**
 * this sock is updating when reconnecting
*/
export const GLOBAL = {
    sock: tempSock,
    store : tempStore,
    muteGroup: tempMuteGroup,
    groupConfig: tempGroupConfig,
    timeouts: tempTimeouts,
    omerReminder: omerReminder,
    clearTimeout: function (id) {
        clearTimeout(this.timeouts[id]);
        console.log("cleared the timeout", this.timeouts[id], " for", id)
    },
    everybodyLastUse2min: function (id) {
        const time = new Date().getTime();
        if (!this.groupConfig[id]?.lastUsedEveryBodyCommand) {
            this.groupConfig[id] = {};
            this.groupConfig[id].lastUsedEveryBodyCommand = time;
            console.log("everybodyLastUse2min: groupConfig not found, created new one");
            return true;
        }
        // check if 2 minutes passed
        if (time - this.groupConfig[id].lastUsedEveryBodyCommand > 120_000) {
            this.groupConfig[id].lastUsedEveryBodyCommand = time;
            console.log("everybodyLastUse2min: 2 minutes passed");
            return true;
        }
        console.log("everybodyLastUse2min: 2 minutes not passed");
        return false;
    },
    canAskGPT: function (id) {
        const time = new Date().getTime();

        if (!this.groupConfig[id]?.lastUsedGPT) {
            this.groupConfig[id] = {};
            this.groupConfig[id].lastUsedGPT = time;
            this.groupConfig[id].countGPT = 1;
            console.log("canAskGPT: groupConfig not found, created new one");
            return true;
        }
        // if paid group
        if (this.groupConfig[id].paidGroup) {
            console.log("canAskGPT: paid group");
            return true;
        }

        // check if 5 minutes passed
        if (time - this.groupConfig[id].lastUsedGPT > 300_000) {
            this.groupConfig[id].lastUsedGPT = time;    // reset timer
            this.groupConfig[id].countGPT = 1;          // reset count
            console.log("canAskGPT: 5 minutes passed");
            return true;
        }
        // check if 3 times passed
        if (this.groupConfig[id].countGPT < 3) {
            this.groupConfig[id].countGPT++;
            console.log("canAskGPT: 3 times not passed");
            return true;
        }
        console.log("canAskGPT: NO! - 3 times passed");
        return false;
    },
    unofficialGPTcredit: 250, // TODO: need to be saved in file
    updateUnofficialGPTcredit: function (tokens, model) {
        // 1 credit for 2000 tokens
        if (["pai-001", "pai-001-rp"].includes(model)) {
            this.unofficialGPTcredit -= tokens / 2000;
        }
        // 1 credit for 4000 tokens
        if (["pai-001-light", "pai-001-light-rp"].includes(model)) {
            this.unofficialGPTcredit -= tokens / 4000;
        }
        console.log("unofficialGPTcredit: ", this.unofficialGPTcredit);
    }
};


readConfig();
readOmerReminder();

setInterval(() => {
    saveConfig();
    saveOmerReminder();
}, 20_000);

function readConfig() {
    if (!fs.existsSync("./groupConfig.json")) {
        console.log("Group Config file not found");
        GLOBAL.groupConfig = {};
        return;
    }

    const data = fs.readFileSync("./groupConfig.json");
    const json = JSON.parse(data);
    console.log(json);
    GLOBAL.groupConfig = json;
}

function saveConfig() {
    const groupConfig = GLOBAL.groupConfig;
    fs.writeFileSync("./groupConfig.json", JSON.stringify(groupConfig));
    //console.log("Group Config saved");
}

// reset count of unofficialGPTcredit every day at 00:00
setInterval(() => {
    const date = new Date();
    if (date.getHours() === 0 && date.getMinutes() === 0) {
        GLOBAL.unofficialGPTcredit = 250;
    }
}, 60_000);

// temp! - saving omerReminder in separate file
function readOmerReminder() {
    let omerReminder = {
        omerInternal: null,
        chats: []
    };

    if (!fs.existsSync("./omerReminder.json")) {
        console.log("Omer Reminder file not found");
    }
    else {
        const data = fs.readFileSync("./omerReminder.json");
        omerReminder = JSON.parse(data);
    }

    GLOBAL.omerReminder = omerReminder;
}

function saveOmerReminder() {
    const omerReminder = GLOBAL.omerReminder;
    fs.writeFileSync("./omerReminder.json", JSON.stringify(omerReminder));
}