Collect questions from Quizziz and automatically export them to a Word File:

Step 1: Git clone: https://github.com/ducngg411/Scan-Quiz-From-Quizziz-To-Word-File.git  then cd Scan-Quiz-From-Quizziz-To-Word-File and npm install

Step 2: Enter this command to the terminal with Quiziz Code
node scraper.js https://quizizz.com/join?gc=XXXXXX (JOIN CODE)

Step 3: You will receive a text file with all the questions, answers, and correct answers from the quiz above. Enter this command in cmd to do!
node txt-to-word.js quizizz_xxxxxxxxx.txt
