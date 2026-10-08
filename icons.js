/* Line icons (24 px grid, stroke = currentColor) so the app uses one clean icon style instead of emojis.
   ICON('home') → inline <svg>. Sizes follow the surrounding font size unless a size is given. */
(function(){
  const P={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11.5h13V9"/><path d="M10 20.5v-6h4v6"/>',
    calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    'calendar-plus':'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M12 13v5M9.5 15.5h5"/>',
    chat:'<path d="M20.5 12a8 8 0 0 1-11.8 7L3.5 20.5l1.4-4.8A8 8 0 1 1 20.5 12z"/>',
    football:'<ellipse cx="12" cy="12" rx="9.5" ry="5.8" transform="rotate(-40 12 12)"/><path d="M9.2 14.8l5.6-5.6M10.6 11.6l1.8 1.8M12.4 9.8l1.8 1.8"/>',
    whistle:'<circle cx="8.5" cy="14" r="5"/><path d="M12.5 11h8v3.5l-4 .5M8.5 14h.01"/><path d="M6 6l1.5 2M10.5 4.5l.3 2.5M15 6l-1.5 2"/>',
    book:'<path d="M4.5 19.5V5a2 2 0 0 1 2-2h13v15.5h-13a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h13"/><path d="M8.5 7.5h7"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    maybe:'<path d="M9.2 9.3a2.9 2.9 0 1 1 4 2.7c-.7.3-1.2.9-1.2 1.7v.5"/><path d="M12 17.5h.01"/>',
    pin:'<path d="M12 21s6.5-5.9 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.1 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    nav:'<path d="M3.5 11 20.5 3.5 13 20.5l-2-7.5z"/>',
    note:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    bell:'<path d="M6 9a6 6 0 1 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    users:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M17.5 14.6a6.5 6.5 0 0 1 4 5.4"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    right:'<path d="m9.5 6 6 6-6 6"/>',
    left:'<path d="m14.5 6-6 6 6 6"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    trophy:'<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3.2 4.5M16 6h3a3 3 0 0 1-3.2 4.5M12 13.5V17M8.5 20.5h7M10 17h4"/>',
    lock:'<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    list:'<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
    grid:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/>',
    play:'<path d="M8 5.5v13l10.5-6.5z"/>',
    sync:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M4 4v4h4M20 20v-4h-4"/>',
    edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash:'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
    send:'<path d="M20.5 3.5 3.5 10.5l7 2.5 2.5 7z"/><path d="M10.5 13 20.5 3.5"/>'
  };
  window.ICON=(n,size)=>`<svg class="ic ic-${n}" viewBox="0 0 24 24" width="${size||'1.15em'}" height="${size||'1.15em'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n]||''}</svg>`;
})();
