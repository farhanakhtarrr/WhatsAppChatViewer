# WhatsApp Chat Viewer

Live: https://w-chatviewer.netlify.app/

A blazing-fast, strictly front-end web application that parses, renders, and visualizes exported WhatsApp chat histories (`.txt`) locally in your browser. Engineered with performance and aesthetics in mind, this viewer accurately emulates both Android and iOS WhatsApp UI with support for massive chat histories.

## Features

- **Instant Loading & Virtual Scrolling:** Built with a custom Virtual Scroller (Windowing) engine. Effortlessly loads and renders `50,000+` chat messages in **zero milliseconds** with no browser lag. 
- **Authentic UI Emulation:** Accurately mimics both **iOS** and **Android** styles. Includes fully responsive Dark and Light modes.
- **Lightning Fast Search:** Real-time search scans through thousands of messages instantly. Jumps to exact scroll positions with highlighted keywords.
- **100% Private & Local:** Everything is processed completely locally via Javascript on your machine. Your chat data never touches a server.
- **Native Emojis:** Accurately renders WhatsApp Android and iOS Apple emojis instead of relying on the host OS emoji font.
- **Customization Options:**
  - Change the background to any solid color.
  - Custom Wallpaper image uploads.
  - Automatically handles light and dark doodle pattern integration.
- **Interactive:** Right-click context menus for quickly copying message text, smooth screenshot features, and floating date tracking.



## How the Virtual Scroller Works

Loading thousands of heavy DOM nodes typically crashes or slows down web browsers. This project implements a sophisticated **Virtual Scroller Engine**:
- Instead of generating 50,000 HTML elements, it calculates exactly which 30 messages should be visible on your screen.
- As you scroll, it swaps out DOM nodes instantly.
- **Variable Height Caching**: Because messages have different heights, the engine dynamically measures and caches the heights of messages as they enter the screen, adjusting scroll anchors mathematically to prevent any jitter or jumping.
- This allows the application to transition themes, change modes, and search instantly without layout thrashing.

