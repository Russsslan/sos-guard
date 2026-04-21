# AppOff

Оффлайн-first приложение для экстренных ситуаций:
- Экстренный экран (вызов 112, координаты, сигнал экраном)
- Быстрые и избранные контакты
- Управление важной информацией (группа крови, аллергии)
- Сохранение и поиск геопозиций
- Шифрованное хранилище (банковские карты)
- Резервное копирование и восстановление данных

Все данные сохраняются локально на устройстве с использованием IndexedDB.

## Быстрый запуск

1. Открой терминал в папке проекта.
2. Запусти:

```powershell
node --input-type=module -e "import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, join } from 'node:path'; const root=process.cwd(); const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'}; createServer(async (req,res)=>{ let url=req.url==='/'?'/index.html':req.url; let file=join(root, decodeURIComponent(url)); try{ let data=await readFile(file); res.writeHead(200, {'Content-Type': mime[extname(file)] || 'text/plain; charset=utf-8'}); res.end(data);}catch{res.writeHead(404); res.end('Not found');}}).listen(8080, ()=>console.log('http://localhost:8080'));"
```

3. Открой в браузере: `http://localhost:8080`.
4. Для телефона: открой этот же адрес по IP компьютера в одной Wi-Fi сети.
5. В Chrome на Android: меню -> "Установить приложение".

## Что дальше улучшить

- Добавить шифрование документов (Web Crypto API + PIN).
- Добавить оффлайн-карты (например, заранее загруженные тайлы).
- Иконки в `manifest.json`.
