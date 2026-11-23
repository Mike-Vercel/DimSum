import { INTRO_SPRITE } from "./sprite";

export const INTRO_SEEN_KEY = "dimsum-intro";

/**
 * Runs before the first paint (see the script below): decides whether the opening plays, so the
 * curtain is already on screen in the server-rendered HTML and the home never flashes first.
 * Plays once per browser session on the home page, never for automated browsers or with reduced
 * motion. `?intro=1` replays it on any page. Safety net: if the animation has not started within
 * 7 s (very slow device) or the visitor taps before it starts, the curtain goes away at once.
 *
 * The installed app (standalone display) never shows the landing: opened on "/" (apps installed
 * before the start URL became /app), it goes straight to /app, i.e. sign-in or the menu. There the
 * opening plays on the first app screen of each launch (sign-in or menu); sessionStorage lives as
 * long as the app is open, so it plays again only when the app is opened anew.
 */
export const INTRO_GATE_SCRIPT = `try{var d=document.documentElement,q=location.search,K="${INTRO_SEEN_KEY}";var f=/[?&]intro=1(&|$)/.test(q);var sa=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;if(sa)d.dataset.app="pwa";if(sa&&!f&&location.pathname==="/"){location.replace("/app")}else if(f||(!navigator.webdriver&&!sessionStorage.getItem(K)&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&(sa?["menu","product","offerte","club","info","account","cart","checkout","supporto","promo","login","registrati"].indexOf(location.pathname.split("/")[1])>-1:location.pathname==="/"))){d.dataset.intro="play";var l=document.createElement("link");l.rel="preload";l.as="image";l.href="${INTRO_SPRITE}";l.setAttribute("fetchpriority","high");document.head.appendChild(l);var off=function(){if(d.dataset.intro==="play"&&!d.dataset.introRun){delete d.dataset.intro;try{sessionStorage.setItem(K,"1")}catch(e){}}};setTimeout(off,7000);addEventListener("pointerdown",off,{once:true,capture:true})}}catch(e){}`;
