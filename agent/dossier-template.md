# Dossier — {име на човека}

The shared case file. The orchestrator and every subagent read and write it. This is how cold-started subagents get warm context without the orchestrator re-typing the person's story. Keep it current; it is the single source of truth for the session.

> One dossier per person, at `Personal/<date>-<slug>/dossier.md` (git-ignored, not the project repo). Update the relevant section after every meaningful exchange or subagent run.

## Profile
- **Име:** {за CV/файлове}
- **Роля / професия:** {}
- **Ниво / години опит:** {}
- **Индустрия:** {}
- **Локация / дистанционно:** {}
- **Адрес за Бюро по труда:** {град и район по постоянен адрес (лична карта); настоящ адрес, ако живее другаде; `неизвестно`, докато не го каже}
- **Език за работа/CV:** {BG / EN / и двете}

## Layoff facts (for story + legal)
- **Тип:** {съкращение / уволнение}
- **Дата на прекратяване:** {}
- **Масово съкращение?** {да/не}
- **Стаж при работодателя:** {}
- **Последна заплата (за изчисления, ако е споделена):** {}

## Emotional read (orchestrator only writes here)
- **Състояние:** {паника / вцепенен / ядосан / делови / обезсърчен}
- **Темпо, което понася:** {}
- **Най-острата болка сега:** {}

## Target
- **Целеви роли:** {}
- **Целеви компании / тип:** {}

## Journey (machine-read by the comeback mod — orchestrator fills)
Where the person is in the four stages of the guide. One entry. `stage` is one fixed ASCII key: `opora` (опора/първите дни), `cv`, `search` (търсене), `interviews` (интервюта) — in that order. `next` is the single concrete next step, one Bulgarian sentence. Stages before the current one are shown as done; the current one is highlighted with "Следва: <next>".
- stage: {opora | cv | search | interviews}
  next: {едно изречение — следващата малка стъпка}

## CV (cv-builder writes here; orchestrator front-loads the brief)
- **Workspace път:** {}
- **Базова версия:** {напр. v1.2}
- **Таргетирани позиции:** {folder → company/position}
- **Отворени gap въпроси:** {}

### CV бриф (front-load — orchestrator попълва, преди да делегира)
- **Обява (URL / компания / длъжност):** {}
- **JD текст:** {пълният текст на обявата, или път до него}
- **Език на CV-то:** {BG / EN — езикът на обявата}
- **Хедър/контакти:** {име · имейл · телефон · LinkedIn · локация}
- **Базово CV:** {има готово / сглобяваме от нулата}
- **Таргет титла/сеньоритет:** {}
- **Постижения с числа:** {метрики за релевантния опит}
- **Умения за мапване към JD:** {}
- **Дати + периоди без работа:** {заетост + обяснени дупки; `неизвестно` където липсва}

## Search (search-strategist writes here)
- **Профил на целта:** {}
- **Мрежа (контакти + статус):** {}
- **Tracker път:** {}
- **Следваща стъпка:** {}

## Company intel (company-intel writes here — one block per posting; feeds interview-coach)
### {компания / длъжност — обява URL}
- **Fit read:** {къде опитът пасва, къде са дупките — честно}
- **„Защо точно тук" angles:** {2–3 конкретни, обвързани с това, което компанията реално прави}
- **Въпроси за задаване:** {остри въпроси, които показват, че човекът е свършил работата}
- **Flags:** {червени флагове в обявата / очевидни несъответствия}
- **Източници / свежест:** {откъде идват фактите + кои застаряват (финансиране/размер/новини)}

## Interviews (interview-coach writes here)
- **Разказ за напускането (текуща форма):** {}
- **Практикувани въпроси + бележки:** {}
- **Топ 2–3 неща за подобрение:** {}

## Legal / benefits (bg-navigator writes here)
- **Срок за бюро по труда:** {дата}
- **Срок за НОИ:** {дата}
- **Оценка на обезщетение:** {estimate — да се потвърди в НОИ}
- **Бюро по труда (ДБТ):** {дирекция „Бюро по труда“ за адреса от Profile: име, адрес, телефон, работно време, линк към страницата ѝ в az.government.bg; или `за проверка` + линк към списъка с бюра}
- **Здравно осигуряване:** {кой плаща сега (държавата докато тече ПОБ / човекът сам) · сума на месец · срок за обр. 7 и за вноската (дати) · линкове към НАП}
- **За потвърждаване:** {}

## Deadlines (machine-read by the comeback mod — orchestrator / bg-navigator fill)
One entry per deadline. Keys are fixed ASCII; values are free text, except `due` and `start` (ISO `YYYY-MM-DD`) and `fact` (one key from the list below). Only deadlines whose `fact` is `✅ потвърдено` in the `Дневник на проверките` of `knowledge-base/bg-legal.md` show as a countdown; the rest show as `за проверка`. Delete entries that no longer apply.
- title: {напр. Регистрация в Бюрото по труда}
  due: {YYYY-MM-DD — крайният срок}
  start: {YYYY-MM-DD — по желание, откога тече срокът, напр. датата на прекратяване}
  docs: {нужни документи, разделени със запетая}
  fact: {bureau-registration | noi-application | health-insurance}
  note: {по желание — кратко за сумата или правилото, напр. „Мин. 24.81 EUR/мес. · обр. 7 и вноската до 25-о“; само от `bg-legal.md`, показва се в панела както е}

## Finances (machine-read by the comeback mod — orchestrator / bg-navigator fill)
Numbers the person shared, for the Финансов хоризонт pane. One entry; keys are fixed ASCII. All amounts are plain numbers in `currency` (default EUR). The mod only adds and divides these — it NEVER derives the НОИ benefit from legal rules. The НОИ amount counts toward the headline figure only when `noi-confirmed` is `да`; otherwise it is shown as "за потвърждение в НОИ" and excluded.
- savings: {сума — налични спестявания}
  monthly-expenses: {сума — месечни разходи}
  severance: {сума — еднократно обезщетение при съкращение (КТ)}
  noi-monthly: {сума — месечно обезщетение от НОИ (оценка; потвърждава се в НОИ)}
  noi-months: {брой месеци, за които НОИ плаща (по данни от НОИ)}
  noi-confirmed: {да | не}
  currency: {EUR}

## Log
- {дата — какво се случи / кой subagent тичаше}
