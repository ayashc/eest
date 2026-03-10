# EEST

EEST — десктопний музичний плеєр на Electron з акцентом на **альбоми як цілісний досвід прослуховування**.

Замість логіки типового стрімінгу тут основа така:
- **Shelf** — повні альбоми, які краще слухати цілком
- **Crate** — фрагменти, сингли та неповні релізи
- **Mixtape** — окрема касета для вибраних треків
- **Songs** — звичайний список усіх треків

Інтерфейс побудований навколо полиці, інспектора праворуч і нижнього playback spine з таймлайном та якістю звуку. Поточний UI і логіка Shelf / Crate / Mixtape / Songs видно в актуальному `index.html`, а підтримка сканування бібліотеки, конфіга і метаданих — у `main.js`. fileciteturn24file0 fileciteturn24file1

---

## Що вже є зараз

- **Liquid glass** — на Windows 11 вікно реально прозоре і розмиває робочий стіл під собою (acrylic ефект)
- **Динамічний акцент** — колір інтерфейсу підлаштовується під обкладинку альбому що грає
- **Групування альбомів** — по артисту, по роках або плоский грід
- **Усі популярні формати** — MP3, FLAC, WAV, OGG, AAC, M4A, OPUS, WMA, DSF, DFF, APE, AIFF, WV, ALAC
- **Зберігає бібліотеку** між сесіями — папки сканує один раз
- **Клавіатура** — `Space` play/pause · `←/→` перемотка на 10с · `Alt+←/→` попередній/наступний трек

---

## Встановлення і запуск

### 1. Встанови Node.js

Підійде актуальна LTS-версія Node.js.

Перевір:

```bash
node -v
npm -v
```

### 2. Склонуй репозиторій

```bash
git clone https://github.com/ayashc/eest.git
cd eest
```

### 3. Встанови залежності

```bash
npm install
```

### 4. Запусти застосунок

```bash
npm start
```

Після старту відкрий **Settings** і додай папку з музикою.

---

## Як оновити проєкт на GitHub

Якщо ти вже в папці репозиторію і хочеш залити свої локальні зміни:

```bash
git status
git add index.html main.js README.md
git commit -m "Update playback spine and refresh README"
git push origin main
```

Якщо в тебе гілка називається не `main`, перевір так:

```bash
git branch
```

і пуш тоді роби у свою поточну гілку.

### Нормальні варіанти commit message

Якщо хочеш просто і людською, ось хороші варіанти:

```bash
git commit -m "Refine playback spine and update README"
```

або

```bash
git commit -m "Fix current player UI and refresh project README"
```

або зовсім просто:

```bash
git commit -m "Update player UI"
```

Я б радив перший варіант: він короткий і нормально описує суть.

---

## Корисні команди

Перевірити, що змінилось:

```bash
git status
```

Подивитись різницю перед комітом:

```bash
git diff
```

Підтягнути останні зміни з GitHub перед пушем:

```bash
git pull --rebase origin main
```

Якщо `git push` каже, що треба спочатку підтягнути зміни — спочатку зроби `git pull --rebase origin main`, а потім ще раз `git push origin main`.

---

## Де лежить конфіг

Конфіг зберігається в userData Electron застосунку у файлі:

```text
eest-config.json
```

У Windows це зазвичай шлях у `AppData/Roaming`. Саме цей файл використовується для папок, mixtape, ambience і stats. fileciteturn24file1

---

## Статус

Проєкт **ще в розробці**. Базова архітектура вже є, але UI і взаємодія ще активно допилюються.
