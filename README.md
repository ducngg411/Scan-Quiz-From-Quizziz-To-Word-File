# Quizizz Extractor

Extract questions and answers from Quizizz quizzes and export them to Word documents.

<p align="center">
  <img src="https://quizizz.com/wf/assets/62fa71f622b3647729334a43_Brand%20Symbol%20-%20Quizizz.svg" alt="Quizizz Logo" width="150">
</p>

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
