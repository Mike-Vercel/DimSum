export const INTRO_SEEN_KEY = "dimsum-intro";

/**
 * Runs before the first paint (see the script below): decides whether the opening plays, so the
 * curtain is already on screen in the server-rendered HTML and the home never flashes first.
 * Plays once per browser session on the home page, never for automated browsers or with reduced
 * motion. `?intro=1` replays it on any page.
 */
export const INTRO_GATE_SCRIPT = `try{var d=document.documentElement,q=location.search;var f=/[?&]intro=1(&|$)/.test(q);if(f||(location.pathname==="/"&&!navigator.webdriver&&!sessionStorage.getItem("${INTRO_SEEN_KEY}")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)){d.dataset.intro="play"}}catch(e){}`;
