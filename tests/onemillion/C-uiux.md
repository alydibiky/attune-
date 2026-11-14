# 1M part C — UI and UX: 840 views (56 screens × 21 languages × light/dark × phone/computer × 3 scroll positions), 9660 checks, 9584 right (99.213%)

| check | failures |
|---|---|
| c10 tap target < 32 px | 6 |
| c15 control covered | 56 |
| c16 back | 14 |

## Every failure class (examples)

### c10 tap target < 32 px
- **button[kn-switch] “Use Knowledge in Chat” 44×24** × 6: knowledge en light computer @top · knowledge en light computer @middle · knowledge en light computer @bottom · knowledge en dark computer @top

### c15 control covered
- **button[header-menu] “Menu” under b “Ya Attune” (+12)** × 6: booklib en light phone @top · booklib en light phone @middle · booklib en light phone @bottom · booklib en dark phone @top
- **button[header-menu] “Chats” under b “Ya Attune” (+9)** × 6: ask en light phone @top · ask en light phone @middle · ask en light phone @bottom · ask en dark phone @top
- **button[header-menu] “Menu” under b “Ya Attune” (+7)** × 6: care en light phone @top · care en light phone @middle · care en light phone @bottom · care en dark phone @top
- **button[side-back] “←” under b “Ya Attune” (+22)** × 6: booklib en light computer @bottom · ask en light computer @top · care en light computer @top · booklib en dark computer @bottom
- **button “” under div[guardian-item] “Ahmed is 3 days late
1,000 E”** × 4: guardian en light phone @middle · guardian en light phone @bottom · guardian en dark phone @middle · guardian en dark phone @bottom
- **button “” under div[guardian-act] “Act now · 1 quiet catches
1,”** × 4: guardian en light computer @middle · guardian en light computer @bottom · guardian en dark computer @middle · guardian en dark computer @bottom
- **button[side-ws-projects] “Projects” under div[voice-screen] “Ya Attune
Offline · private
”** × 4: voice en light computer @bottom · automations en light computer @bottom · voice en dark computer @bottom · automations en dark computer @bottom
- **button[side-back] “←” under b “Ya Attune” (+18)** × 4: ask en light computer @middle · care en light computer @middle · ask en dark computer @middle · care en dark computer @middle
- **button[side-back] “←” under b “Ya Attune” (+19)** × 4: ask en light computer @bottom · care en light computer @bottom · ask en dark computer @bottom · care en dark computer @bottom
- **button[header-back] “Back” under b “Ya Attune” (+4)** × 2: automations en light phone @top · automations en dark phone @top
- **button[auto-ready-toggle] “Turn on” under div “«hello from voice»

To answe” (+2)** × 2: automations en light phone @bottom · automations en dark phone @bottom
- **button[side-home] “Attune” under span “Offline · private” (+17)** × 2: voice en light computer @top · voice en dark computer @top
- **button[side-back] “←” under b “Ya Attune” (+25)** × 2: booklib en light computer @top · booklib en dark computer @top
- **button[side-back] “←” under b “Ya Attune” (+21)** × 2: booklib en light computer @middle · booklib en dark computer @middle
- **button[side-back] “←” under b “Ya Attune” (+12)** × 2: automations en light computer @top · automations en dark computer @top

### c16 back
- **Back did nothing** × 14: map en light computer @back · lifeask en light computer @back · copilot en light computer @back · compress en light computer @back
