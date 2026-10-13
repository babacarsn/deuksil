/* ==========================================================================
   MODULE : ai-icon.js — icône dessinée de l'assistant DEUKSIL
   Bulle de discussion en forme de maison (immobilier + conversation) avec une
   étincelle dorée (intelligence). Remplace l'ancienne icône générique.
   ========================================================================== */
ICONS.sparkle = '<g transform="scale(.75)" stroke="none">'
  + '<path fill="currentColor" d="M16 3.2 27.4 11.6Q28.4 12.4 28.4 13.6V21Q28.4 23.6 25.8 23.6H14.6L9.4 28.2Q8.6 28.9 8.6 27.8V23.6H6.2Q3.6 23.6 3.6 21V13.6Q3.6 12.4 4.6 11.6Z"/>'
  + '<path fill="#C99A4B" d="M16 9.4C16.5 13 17.6 14.3 21.2 14.9 17.6 15.5 16.5 16.8 16 20.4 15.5 16.8 14.4 15.5 10.8 14.9 14.4 14.3 15.5 13 16 9.4Z"/>'
  + '<path fill="#C99A4B" d="M21.8 8.6C21.9 9.8 22.3 10.2 23.5 10.4 22.3 10.6 21.9 11 21.8 12.2 21.7 11 21.3 10.6 20.1 10.4 21.3 10.2 21.7 9.8 21.8 8.6Z"/></g>';
document.head.insertAdjacentHTML('beforeend', `<style>
.ai-fab{width:58px;height:58px;color:#fff;background:linear-gradient(145deg,var(--brand) 0%,#0C2745 100%);box-shadow:0 10px 24px rgba(10,35,66,.38),0 0 0 2px #C99A4B,0 0 0 6px rgba(201,154,75,.16)}
.ai-fab svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.28))}
.ai-fab:before{content:"";position:absolute;inset:-7px;border-radius:50%;border:1.5px solid #C99A4B;opacity:0;pointer-events:none;animation:aiPulse 3.4s ease-out infinite}
.ai-fab:after{content:"Assistant DEUKSIL";position:absolute;right:68px;top:50%;transform:translateY(-50%) translateX(6px);padding:6px 11px;border-radius:99px;background:#0C2745;color:#fff;font:600 12px/1 var(--font-sans,system-ui);white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s,transform .15s}
.ai-fab:hover:after,.ai-fab:focus-visible:after{opacity:1;transform:translateY(-50%)}
.ai-fab:active{transform:scale(.96)}
@keyframes aiPulse{0%{transform:scale(.9);opacity:.6}70%,100%{transform:scale(1.22);opacity:0}}
@media (prefers-reduced-motion:reduce){.ai-fab:before{animation:none}}
@media (max-width:760px){.ai-fab{width:54px;height:54px}.ai-fab:after{display:none}}
</style>`);
