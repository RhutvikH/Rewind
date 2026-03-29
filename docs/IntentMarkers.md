# Rewind: Intent Markers

Rewind is a lightweight, lightning-fast VS Code extension that allows developers to seamlessly drop **Intent Markers** onto any line of code in their workspace.

Intent markers act as highly visible "badges" that clearly communicate *why* a piece of code exists or *what* needs to be done with it, making asynchronous code reviews, pair programming, and personal reminders incredibly easy.

## 🎯 Features

- **Add Intent Markers Anywhere:** Place markers like `Refactoring`, `Bug Fix`, `Needs Review`, or `Complex Logic` on any line of code.
- **Smart Grouping:** Stack multiple markers on the same line and they intelligently group into a single clean badge, keeping your editor tidy.
- **Elegant Visuals:** Code lines get a soft, customizable background highlight with a floating badge at the end of the line, complete with markdown-enabled hover descriptions.
- **Customizable Colors:** Don't like the default yellow highlight? Change it instantly! Specify any CSS background color (e.g., `rgba(0, 255, 0, 0.2)` or `#ff000044`) in your settings, and all active markers update live.
- **Custom Categories:** Have a specific team workflow? Create your own custom labels on the fly directly from the Command Palette, and they'll be permanently saved as reusable options.
- **Easy Cleanup:** Remove individual markers with smart selectors, or purge entire custom categories (which actively hunts down and deletes every matching marker in your workspace!).

## 🚀 Quick Start

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Search for **`Rewind: Add Intent Marker`**.
3. Select an intent category from the list (or click `➕ Create Custom Intent...` to inject your own).
4. Add an optional description to explain your thought process.
5. Watch the marker natively appear on the active line!

### Managing Markers
- **`Rewind: Remove Intent Marker`** (`rewind.removeIntentMarker`): Run this command on any highlighted line to delete the marker. If there are multiple markers stacked on that line, a stylish dropdown will let you choose exactly which one to delete!
- **`Rewind: Delete Custom Intent Category`** (`rewind.removeCustomIntentCategory`): Want to clean up your custom labels? Run this command to delete a custom category. *(Note: Doing this will recursively sweep through your active files and cleanly erase any markers currently using that deleted category!)*

## ⚙️ Extension Settings

You can customize the extension directly through your VS Code User settings:

* `rewind.intentMarkerColor`: Controls the background highlight color of the marked lines. (Default: `rgba(255, 255, 0, 0.2)`)
* `rewind.customIntentCategories`: An array of strings containing your saved custom intent labels.