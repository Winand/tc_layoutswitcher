// ==UserScript==
// @name         TypingClub layout switcher
// @namespace    Winand
// @version      20.1206
// @description  Auto-switch keyboard layouts on TypingClub website
// @author       Winand
// @match        https://www.typingclub.com/sportal/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==


(function() {
    'use strict';

    const url_api = "https://www.typingclub.com/api/v1.1/";
    const url_tokens = url_api + "student/refresh_tokens/";
    const url_program = url_api + "program/";
    const url_student = url_api + "student/";
    const default_layout = "en,british-pc"

    var token;
    var student_id;
    var program_id;
    var program_kbd;
    var keyboard;
    var keyboard_pending;

    (function(open, send) {
        // https://stackoverflow.com/a/56499250
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("load", function() {
                var url = this.responseURL;
                if(url == url_tokens && this.status == 200) {
                    if(this.responseText) {
                        const resp = JSON.parse(this.responseText)[0];
                        token = resp.token;
                    } else console.log("TOKEN NOT REFRESHED");
                } else if(url.startsWith(url_program) && !url.includes("/game/") && this.status == 200) {
                    const resp = JSON.parse(this.responseText);
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
                        console.log("SWITCH TO", target_kbd);

                        fetch(url_student + student_id + "/", {
                            method: 'POST',
                            body: '{"keyboard":"' + target_kbd + '"}',
                            headers: {
                                'authorization': 'Token ' + token,
                                'Content-type': 'application/json',
                                'x-http-method-override': 'PATCH'
                            }
                        }).then(val => window.location.reload());
                    }
                } else if(url.startsWith(url_student + "me/") && this.status == 200) {
                    const resp = JSON.parse(this.responseText);
                    student_id = resp.id;
                    keyboard = resp.keyboard;
                } else if(url == url_student + student_id + "/") {
                    if(this.status == 202) {
                        keyboard = keyboard_pending;
                        GM_setValue("lang." + program_id, keyboard);
                    }
                    console.log("MANUAL SWITCH TO", keyboard, "FOR PROGRAM", program_id);
                }
            }, false);
            open.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            var url = new URL(this.__sentry_xhr__.url, document.baseURI).href
            if(url == url_student + student_id + "/") {
                keyboard_pending = JSON.parse(body).keyboard;
            }
            send.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open, XMLHttpRequest.prototype.send);
})();
