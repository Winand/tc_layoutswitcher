// ==UserScript==
// @name         TypingClub layout switcher
// @namespace    Winand
// @version      23.314
// @description  Auto-switch keyboard layouts on TypingClub website
// @homepageURL  https://github.com/Winand/tc_layoutswitcher
// @downloadURL  https://github.com/Winand/tc_layoutswitcher/raw/master/tc_layoutswitcher.user.js
// @updateURL    https://github.com/Winand/tc_layoutswitcher/raw/master/tc_layoutswitcher.user.js
// @author       Winand
// @license      MIT
// @match        https://www.typingclub.com/*
// @match        https://www.edclub.com/sportal/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==


(function() {
    'use strict';

    const url_api = window.location.origin + "/api/v1.1/";
    const url_student = url_api + "student/";
    const url_tokens = window.location.origin + "/auth/refresh_tokens/";
    const url_program = "//static.typingclub.com/m/build/lessonplans/"; // url_api + "program2/";
    // in case there's no saved layout and current program doesn't define one either
    const default_layout = "en,british-pc";

    var token; // authorization token is needed to change layout
    var student_id; // current user numeric id
    var program_id; // current program numeric id
    var program_kbd; // keyboard layout defined in current program
    var keyboard; // current layout
    var keyboard_pending; // layout is being set

    (function(open, send, window_fetch) {
        // https://stackoverflow.com/a/56499250

        unsafeWindow.fetch = async (resource, ...args) => {
            // https://stackoverflow.com/a/64961272/1119602
            const response = await window_fetch(resource, ...args);
            if(resource.startsWith(url_program) && response.ok) {
                response.clone().json().then(resp => {
                    program_id = resp.id;
                    program_kbd = resp.keyboard == null ? default_layout : resp.keyboard;
                    var target_kbd = GM_getValue("lang." + program_id);
                    if(target_kbd == undefined) {
                        // set program's default layout
                        GM_setValue("lang." + program_id, program_kbd);
                        target_kbd = program_kbd;
                    }
                    console.log("PROGRAM KBD", program_kbd, "CURRENT", keyboard, "TARGET", target_kbd);
                    if(target_kbd !== keyboard) {
                        console.log("SWITCH TO", target_kbd, "TOKEN", token);

                        fetch(url_student + student_id + "/", {
                            method: 'POST',
                            body: '{"keyboard":"' + target_kbd + '"}',
                            headers: {
                                'authorization': 'Token ' + token,
                                'Content-type': 'application/json',
                                'x-http-method-override': 'PATCH'
                            }
                        }).then(response => {
                            if(response.status == 202) {
                                window.location.reload();
                            } else console.log("SWITCH FAILED WITH STATUS", response.status);
                        });
                    }
                }).catch(err => console.error(err));
            }
            return response;
        };
        // unsafeWindow.fetch.toString = () => "function fetch() {   [native code]   }";

        XMLHttpRequest.prototype.open = function(method, url) {
            this._url = window.location.origin + url
            this.addEventListener("load", function() {
                var url = this.responseURL;
                if(url == url_tokens && this.status == 200) {
                    if(this.responseText) {
                        const resp = JSON.parse(this.responseText)[0];
                        token = resp.token;
                        console.log("TOKEN REFRESHED", token);
                    } else console.log("TOKEN NOT REFRESHED");
                } else if(url.startsWith(url_student + "me/") && this.status == 200) {
                    const resp = JSON.parse(this.responseText);
                    student_id = resp.id;
                    keyboard = resp.keyboard;
                } else if(url == url_student + student_id + "/" && keyboard_pending !== undefined) {
                    if(this.status == 202) {
                        keyboard = keyboard_pending;
                        GM_setValue("lang." + program_id, keyboard);
                        console.log("MANUAL SWITCH TO", keyboard, "FOR PROGRAM", program_id);
                    } else console.log("MANUAL SWITCH FROM", keyboard, "TO", keyboard_pending, "FOR PROGRAM", program_id, "FAILED");
                }
            }, false);
            open.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            if(this._url == url_student + student_id + "/") {
                // 'keyboard' may be undefined if other property is being changed
                keyboard_pending = JSON.parse(body).keyboard;
            }
            send.apply(this, arguments);
        };

        if("prototype" in send) {
            console.log("LOADED TOO LATE, TRYING TO REFRESH TOKEN");
            var poll_timer = setInterval(() => {
                if(!token) {
                    console.log("RESTART...");
                    start(); // TypingClub entry point
                } else clearTimeout(poll_timer);
            }, 1000);
        };
    })(XMLHttpRequest.prototype.open, XMLHttpRequest.prototype.send, window.fetch);
})();
