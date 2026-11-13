# Chat orders the code leaves to the model — real model

Model: qwen3.5-4b · 250 of 784 such orders (of 20000) · 2.7 s each on this machine (4 CPU cores)

**Model picked the right kind: 244/250 = 97.6%**

| group | n | right |
|---|---|---|
| indirect_remind_en | 45 | 100.0% |
| other_languages | 12 | 100.0% |
| agents_odd | 151 | 100.0% |
| indirect_remind_ar | 26 | 100.0% |
| corrections | 4 | 100.0% |
| open_pages | 6 | 0.0% |
| story_spend | 6 | 100.0% |

Note: the 6 wrong ones (all «open the reminders page» in Arabic) never reach the model in the app: Chat opens a page by its name before the referee (chat.jsx pageOf), so they are right by code. The counter that sent them here was fixed after this run. Without them: 244/244.

## Wrong
- [open_pages] «يا أتيون، وريني التذكيرات!!» → model "action", want open (action/chat)
- [open_pages] «بقولك افتحلي صفحة التذكيرات!!» → model "action", want open (action/chat)
- [open_pages] «افتحلي التذكيرات» → model "action", want open (action/chat)
- [open_pages] «طيب افتحلي التذكيرات!!» → model "action", want open (action/chat)
- [open_pages] «عايز اشوف التذكيرات» → model "chat", want open (action/chat)
- [open_pages] «طيب وديني على التذكيرات» → model "action", want open (action/chat)
