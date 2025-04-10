<<<<<<< HEAD
# Quizizz Scraper

A tool that automatically collects questions and answers from Quizizz and exports them to a well-formatted Word document.

## ✨ Key Features

- **Automatic collection** of questions and answers from Quizizz
- **Identifies correct answers** and clearly marks them
- **Exports to Word** with professional formatting
- **Supports multiple formats** of questions and answers
- **Converts existing text files** to Word documents
- **Automatic navigation** and handling of complex scenarios
- **Headless mode** for background operation

## 🖥️ System Requirements

- **Node.js** (version 14.0.0 or higher)
- **npm** (version 6.0.0 or higher)
- Stable internet connection

## 📥 Installation

1. Download the `quizizz-scraper.js` file to your computer or clone the repository:

```bash
git clone https://github.com/ducngg411/Scan-Quiz-From-Quizziz-To-Word-File.git
```

2. Install the required libraries:

```bash
npm install puppeteer docx fs
```

## 🚀 Usage Instructions

### Collecting Questions from Quizizz

To join a Quizizz game and collect questions:

```bash
node quizizz-scraper.js join <game-code-or-URL>
```

**Examples:**
```bash
node quizizz-scraper.js join 12345678
```

Or using the full URL:
```bash
node quizizz-scraper.js join https://quizizz.com/join?gc=12345678
```

### Converting Existing Text Files to Word

If you already have a text file containing questions and answers:

```bash
node quizizz-scraper.js convert <input-file.txt> [output-file.docx]
```

**Example:**
```bash
node quizizz-scraper.js convert quizizz_1234567890.txt
```

### Text File Format

The input text file must follow this format for accurate conversion:

```
Quiz Title

Question 1: Question content?

A. Answer A
B. Answer B
C. Answer C (CORRECT ANSWER)
D. Answer D

Question 2: Another question content?
...
```

## ⚙️ Options

You can use the following options when running the tool:

| Option | Description |
|----------|-------|
| `--headless` | Run in headless mode (browser not visible) |
| `--timeout=<number>` | Set maximum runtime (in minutes) |
| `--name=<name>` | Set player name when joining the quiz |

**Example:**
```bash
node quizizz-scraper.js join 12345678 --headless --timeout=20 --name=SmartStudent
```

## 🔧 Troubleshooting Common Issues

### Cannot Find Correct Answers

In some cases, the tool may not be able to identify the correct answers due to changes in the Quizizz page structure. If this happens, you can:

1. Run the tool again and try a different browser
2. Use non-headless mode (don't use the `--headless` option)
3. Check if you have full access to the quiz

### Errors When Converting to Word

If you encounter errors when converting to Word, the tool will automatically export to a text file (`.txt`). You can:

1. Check if all libraries are properly installed
2. Try converting the text file again using the `convert` command
3. Check if you have write permissions in the current directory

---

*Note: This tool should only be used for educational and research purposes. Please respect Quizizz's terms of service.*
=======
# Quizizz Extractor

Extract questions and answers from Quizizz quizzes and export them to Word documents.

## 📋 Features

- Extract all questions from a Quizizz game
- Capture all answer options and correct answers
- Export data to a structured Word document
- Simple command-line interface

## 🚀 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ducngg411/Scan-Quiz-From-Quizziz-To-Word-File.git
   ```

2. Navigate to the project directory:
   ```bash
   cd Scan-Quiz-From-Quizziz-To-Word-File
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## 🔧 Usage

### Step 1: Extract Quiz Data

Run the scraper with the Quizizz join URL:

```bash
node scraper.js https://quizizz.com/join?gc=XXXXXX
```

Replace `XXXXXX` with the actual join code for the quiz.

### Step 2: Convert to Word Document

After running the scraper, a text file named `quizizz_[timestamp].txt` will be generated. Convert this file to a Word document with:

```bash
node txt-to-word.js quizizz_[timestamp].txt
```

Replace `[timestamp]` with the actual timestamp in the filename.

## 📄 Output

The generated Word document will include:
- All questions from the quiz
- All answer options for each question
- Clear indication of the correct answer

## ⚠️ Disclaimer

This tool is for educational purposes only. Please respect Quizizz's terms of service and only use this tool for quizzes you have permission to access.
>>>>>>> 0ae97b3f27ec9bd66f40ae2cc5106c20313b200f
