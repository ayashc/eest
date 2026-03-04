# eest

Мінімалістичний музичний плеєр з акцентом на альбоми.  
Minimalist music player focused on albums.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/built%20with-Electron-47848F)
![Status](https://img.shields.io/badge/status-in%20development-orange)

## Що вміє / Features

- Сканує папки і будує бібліотеку автоматично
- Підтримує всі популярні формати: MP3, FLAC, WAV, OGG, AAC, M4A, OPUS, WMA, DSF, APE, AIFF та інші
- Liquid glass інтерфейс з динамічним акцентним кольором під обкладинку
- Грід альбомів з обкладинками - слухай альбоми цілком, так, як їх задумав артист
- Клавіатурні скорочення: `Space` play/pause · `←/→` перемотка · `Alt+←/→` трек

## Запуск / Run

```bash
npm install
npm start
```

## Стек / Stack

- [Electron](https://www.electronjs.org/)
- [music-metadata](https://github.com/borewit/music-metadata)