# eest

Мінімалістичний десктопний музичний плеєр з акцентом на альбоми і настрій.  
Liquid glass інтерфейс, підтримка FLAC/MP3/WAV та ще десятка форматів, розумний Mood який підбирає альбом під стан.

![Platform](https://img.shields.io/badge/platform-Windows%2011-blue)
![Electron](https://img.shields.io/badge/built%20with-Electron-47848F)
![Status](https://img.shields.io/badge/status-in%20development-orange)

---

## Що вміє

- **Liquid glass** — на Windows 11 вікно реально прозоре і розмиває робочий стіл під собою (acrylic ефект)
- **Динамічний акцент** — колір інтерфейсу підлаштовується під обкладинку альбому що грає
- **Групування альбомів** — по артисту, по роках або плоский грід
- **Усі популярні формати** — MP3, FLAC, WAV, OGG, AAC, M4A, OPUS, WMA, DSF, DFF, APE, AIFF, WV, ALAC
- **Зберігає бібліотеку** між сесіями — папки сканує один раз
- **Клавіатура** — `Space` play/pause · `←/→` перемотка на 10с · `Alt+←/→` попередній/наступний трек

---

## Встановлення і запуск

### 1. Встанови Node.js

Зайди на [nodejs.org](https://nodejs.org) і скачай версію **LTS** (зараз це 20.x або 22.x).  
Під час встановлення нічого не міняй — просто Next → Next → Install.

Перевір що встановилось. Відкрий термінал (`Win + R` → `cmd`) і введи:

```
node -v
npm -v
```

Обидва мають вивести версію, наприклад `v22.11.0` і `10.9.0`.

---

### 2. Встанови Git

Зайди на [git-scm.com](https://git-scm.com/download/win) і скачай інсталятор.  
Під час встановлення на кроці **"Adjusting your PATH"** обери **"Git from the command line and also from 3rd-party software"**.  
Решту — за замовчуванням.

Перевір:

```
git -v
```

---

### 3. Склонуй репозиторій

Відкрий термінал в папці куди хочеш покласти плеєр і виконай:

```bash
git clone https://github.com/ayashc/eest.git
cd eest
```

---

### 4. Встанови залежності

```bash
npm install
```

Ця команда скачує Electron і всі бібліотеки (~300 МБ, тільки перший раз, потім не треба).

---

### 5. Запусти

```bash
npm start
```

Відкриється вікно плеєра. Натисни **⚙** у правому куті → **Додати папку** і вкажи папку з музикою.

---

## Оновлення

Коли вийде нова версія:

```bash
git pull
npm install
npm start
```

---

## Де зберігається конфіг

Список папок зберігається автоматично тут:

```
C:\Users\<ім'я>\AppData\Roaming\eest\eest-config.json
```

Якщо щось зламалось — просто видали цей файл, плеєр стартує як новий.

---

## Стек

| | |
|---|---|
| [Electron](https://www.electronjs.org/) | Десктопний застосунок на веб-технологіях |
| [music-metadata](https://github.com/borewit/music-metadata) | Читає теги (назва, артист, обкладинка, BPM, жанр) з аудіофайлів |
| [Fixel Font](https://github.com/kirillmurashov/fixel-font) | Українсько-латинський шрифт |

---

## Структура проєкту

```
eest/
├── src/
│   ├── index.html      # весь UI + логіка
│   └── fonts/          # Fixel шрифт
├── main.js             # Electron main process
├── package.json
└── README.md
```
