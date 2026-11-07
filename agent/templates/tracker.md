# Template: application tracker (`tracker.md`)

Blueprint for the person's live search tracker. The **search-strategist** creates one copy in the person's workspace; the **orchestrator** keeps it current and reads it to nudge. English notes below are for the agents; everything the person sees is **Bulgarian**.

**Design intent — this is not a spreadsheet the person maintains:**
- **The agent maintains it, not the person.** They say "пратих CV на Х", "имам разговор с Y в петък" — the agent updates. No column-fiddling.
- **Morale-first ordering.** The momentum block and things *in motion* sit on top. Closed doors sit at the bottom, reframed as data (what we learned), never a wall of "не"-та.
- **Count actions, not outcomes.** The header tracks contacts made and applications sent — what the person controls — not who replied.
- **Connected, not an island.** Each row links to the tailored CV, the outreach draft, and interview notes for that opportunity.

**Hybrid format:** this markdown file is the source of truth the agent keeps live. On request, export a clean `.xlsx` snapshot (`python scripts/tracker_to_xlsx.py` — or the `xlsx` skill inside Claude Code) so the person can sort/filter/share offline — the markdown stays canonical.

**Status конвейер (one funnel, always these stages):**
`Идентифициран → Контакт/CV изпратен → Отговор → Разговор насрочен → В процес → Изход (да / не / тишина)`

Where things die reveals the problem — the orchestrator diagnoses from this (see `orchestrator.md`), the person just sees their pipeline.

---
---
*(Everything below this line is the person-facing file. Copy from here down into the workspace.)*

# Търсене на работа — {име}

Тук не броим отхвърляния. Броим движение. Ти контролираш колко контакта правиш и колко кандидатури пускаш — не кой ще отговори. Този файл гледа тях.

## 📊 Инерция — седмица {дата}

- **Смислени контакти:** {0} / цел {4}
- **Таргетирани кандидатури:** {0} / цел {2}
- **Follow-up за тази седмица:** {0}
- **Активни разговори точно сега:** {0}
- **Серия седмици с движение:** {0}
- **Последна победа:** {последното нещо, което мина добре — топъл отговор, покана за разговор, добра среща}

> Ритъм: {X} часа/ден. Седмична цел в *действия*, не в резултати.

---

## 🟢 В движение — активни разговори

Нещата, които се случват сега. Тук гледаме първо.

| Компания | Роля | Статус | Следваща стъпка (дата) | Връзки | Контакт |
|---|---|---|---|---|---|
| {Acme} | {PM} | Разговор насрочен | {подготовка за интервю — 26.08} | {CV: `.../acme/`, интервю: dossier} | {Иван, LinkedIn} |

Статуси тук: `Отговор` · `Разговор насрочен` · `В процес`.

---

## 🟡 Изпратено, чака — за follow-up

Пуснато, още без отговор. Follow-up **веднъж**, после оставяме на мира.

| Компания | Роля | Изпратено | Follow-up на | Връзки | Контакт |
|---|---|---|---|---|---|
| {Beta} | {Senior PM} | {18.08} | {25.08} | {CV: `.../beta/`, outreach: изпратен} | {—} |

Статус тук: `Контакт/CV изпратен`.

---

## ⚪ Цели — още недокоснати

Идентифицирани възможности, до които не си стигнал. Опашката, не задължение.

| Компания | Роля | Защо тя | Как да вляза | Приоритет |
|---|---|---|---|---|
| {Gamma} | {PM} | {близо до опита ти в X} | {топъл контакт през Мария / студен outreach} | {висок} |

Статус тук: `Идентифициран`.

---

## 📁 Затворени — и какво научихме

Не гробище. Данни. Всеки затворен ред ни казва нещо за системата, не за теб.

| Компания | Роля | Изход | Какво научихме |
|---|---|---|---|
| {Delta} | {PM} | тишина след CV | {CV-то може да не минава ATS — да проверим} |
| {Epsilon} | {PM} | не след интервю | {разказът за напускането да се стегне — interview-coach} |

Изходи: `да` · `не` · `тишина`.

---

## Легенда

- **Връзки:** път до таргетираното CV (cv-builder), статус на outreach draft, бележки от interview-coach — за да е целият контекст на един ред.
- **Статус конвейер:** `Идентифициран → Контакт/CV изпратен → Отговор → Разговор насрочен → В процес → Изход`.
- Искаш ли `.xlsx` версия за сортиране/споделяне — кажи, правя snapshot.
