// Quizizz Scraper - Thu thập câu hỏi và đáp án và xuất ra Word
// Sử dụng Node.js với các thư viện puppeteer và docx

const puppeteer = require('puppeteer');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const fs = require('fs');

class QuizizzScraper {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.quizTimeout = null;
    this.maxQuizDuration = options.maxDuration || 15 * 60 * 1000; // 15 phút tối đa
    this.headless = options.headless !== undefined ? options.headless : false;
    this.quizData = {
      title: '',
      questions: []
    };
  }

  async initialize() {
    console.log('Khởi tạo trình duyệt...');
    this.browser = await puppeteer.launch({
      headless: this.headless,
      defaultViewport: null,
      args: ['--start-maximized']
    });
    this.page = await this.browser.newPage();
    
    // Tăng thời gian timeout
    await this.page.setDefaultNavigationTimeout(60000);
    
    // Thiết lập user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async joinGame(gameCode, playerName = null) {
    try {
      // Trích xuất mã game từ URL
      let code = gameCode;
      if (gameCode.includes('quizizz.com/join')) {
        // Nếu là URL đầy đủ, trích xuất mã game
        const match = gameCode.match(/gc=(\d+)/);
        if (match && match[1]) {
          code = match[1];
        }
      }
  
      // Tạo tên ngẫu nhiên nếu không cung cấp tên
      if (!playerName) {
        const randomNames = [
            "NãoToMoMo", "TríThôngMinhHơnLúi", "SiêuTrí800", "BậcThầyChơiChữ", 
            "NãoBéHàngKhủng", "TrùmTrắcNghiệm", "SoiNãoIQ9999", "HiệpSĩBàiThi", 
            "MáyTínhDiBộ", "ÔngThầnĐiểmCao", "NãoPhoBênTrái", "TrạngNguyênGenz",
            "ĐầuĐầyKiếnThức", "PhốngTrọcBácHọc", "SiêuNãoTikTok", "QuizLordLụa"
        ];
        const randomNum = Math.floor(Math.random() * 1000);
        playerName = randomNames[Math.floor(Math.random() * randomNames.length)] + randomNum;
      }
  
      console.log(`Tham gia game với mã: ${code} và tên: ${playerName}`);
      await this.page.goto(`https://quizizz.com/join?gc=${code}`, { waitUntil: 'networkidle2' });
  
      // Đăng nhập với vai trò học sinh
      console.log('Đang nhập tên...');
      
      // Sử dụng selector chính xác
      await this.page.waitForSelector('input.enter-name-field', { timeout: 60000 });
      await this.page.type('input.enter-name-field', playerName);
      
      // Nhấn nút Start
      await this.page.click('button[data-cy="start-game-button"]');
      
      // Đợi và nhấn nút Start game trong phòng chờ
      await this.page.waitForSelector('button[data-cy="start-game-button-waiting"]', 
        { timeout: 60000 });
      await this.page.click('button[data-cy="start-game-button-waiting"]');
      
      console.log('Đã vào game, bắt đầu thu thập dữ liệu...');
      
      // Đợi một chút để đảm bảo đã vào màn hình chính
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await this.collectQuizData();
    } catch (error) {
      console.error('Lỗi khi tham gia game:', error);
      throw error;
    }
  }

  async collectQuizData() {
    try {
      // Thu thập tiêu đề
      const quizTitle = await this.page.evaluate(() => {
        const titleElement = document.querySelector('.quiz-name');
        return titleElement ? titleElement.textContent.trim() : 'Quizizz Quiz';
      });
      this.quizData.title = quizTitle;
      console.log(`Tiêu đề: ${quizTitle}`);

      // Chờ bắt đầu
      await this.waitForStartButton();
      
      // Bắt đầu chơi và thu thập dữ liệu
      await this.playAndCollect();
      
      // Xuất dữ liệu sang Word
      await this.exportToWord();
      
      console.log('Hoàn tất thu thập dữ liệu!');
    } catch (error) {
      console.error('Lỗi khi thu thập dữ liệu:', error);
    }
  }

  async waitForStartButton() {
    try {
      console.log('Đợi nút bắt đầu...');
      await this.page.waitForSelector('button.start-game', { timeout: 30000 });
      await this.page.click('button.start-game');
      console.log('Đã bấm nút bắt đầu');
    } catch (error) {
      console.log('Không tìm thấy nút bắt đầu, có thể game đã bắt đầu');
    }
  }

  async playAndCollect() {
    let questionCount = 0;
    let isLastQuestion = false;
  
    // Bắt đầu đếm thời gian
    this.startQuizTimeout();
  
    // Danh sách lưu trữ câu hỏi đã xử lý để tránh lưu trùng lặp
    const processedQuestions = new Set();
  
    while (!isLastQuestion) {
      try {
        console.log(`Đang xử lý phần tử ${questionCount + 1}...`);
        
        // Cải thiện cách phát hiện màn hình "Reattempt"
        const isReattempt = await this.page.evaluate(() => {
          // Kiểm tra nhiều cách khác nhau để phát hiện màn hình Reattempt
          
          // 1. Kiểm tra text "Reattempt"
          const reattemptText = document.querySelector('p.explanation');
          if (reattemptText && reattemptText.textContent.includes('Reattempt')) {
            return true;
          }
          
          // 2. Kiểm tra sự hiện diện của các dot đặc biệt trong màn hình reattempt
          const dots = document.querySelectorAll('.dot-row .dot');
          if (dots.length > 0 && !document.querySelector('.question-text-color')) {
            return true;
          }
          
          // 3. Kiểm tra sự thiếu vắng của câu hỏi nhưng có các dot
          if (!document.querySelector('.question-text-color') && 
              !document.querySelector('button.option') && 
              document.querySelectorAll('.dot').length > 0) {
            return true;
          }
          
          return false;
        });
        
        if (isReattempt) {
          console.log('Phát hiện màn hình trả lời lại câu hỏi (Reattempt)');
          
          // Tìm và bấm vào lựa chọn đầu tiên
          try {
            // Thử bấm vào dot đầu tiên
            const dots = await this.page.$$('.dot');
            if (dots && dots.length > 0) {
              await dots[0].click();
              console.log('Đã bấm vào dot đầu tiên trong màn hình Reattempt');
            } else {
              // Thử tìm các phần tử khác có thể click
              const clickableElements = await this.page.$$('.content, .dot-row, .flex-view');
              if (clickableElements && clickableElements.length > 0) {
                await clickableElements[0].click();
                console.log('Đã bấm vào phần tử có thể click trong màn hình Reattempt');
              } else {
                // Thử bấm vào vị trí cố định trên trang
                console.log('Không tìm thấy dot, thử bấm vào vị trí cố định');
                await this.page.mouse.click(300, 300);
              }
            }
            
            // Đợi để chuyển sang câu hỏi tiếp theo
            console.log('Đợi 5 giây sau khi xử lý màn hình Reattempt...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Tiếp tục vòng lặp mà không tăng questionCount
            continue;
          } catch (error) {
            console.error('Lỗi khi xử lý màn hình Reattempt:', error);
          }
        }
        
        // Đợi câu hỏi hiển thị
        await this.page.waitForSelector('.question-text-color', { timeout: 30000 });
        
        // Đợi một chút để đảm bảo trang đã tải hoàn toàn
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Kiểm tra xem có đáp án nào hiển thị không
        const hasOptions = await this.page.evaluate(() => {
          return document.querySelectorAll('button.option').length > 0;
        });
        
        if (!hasOptions) {
          console.log('Không tìm thấy đáp án, có thể quiz đã kết thúc');
          isLastQuestion = true;
          break;
        }
        
        // Thu thập thông tin câu hỏi và các lựa chọn
        const questionData = await this.page.evaluate(() => {
          const questionText = document.querySelector('.question-text-color').textContent.trim();
          
          // Tìm tất cả các lựa chọn dựa trên selector mới
          const options = Array.from(document.querySelectorAll('.resizeable-text .resizeable'))
            .map(option => {
              const text = option.textContent.trim();
              // Kiểm tra và loại bỏ nếu nội dung trùng với câu hỏi
              return text.includes(questionText) ? '' : text;
            })
            .filter(text => text !== ''); // Loại bỏ các chuỗi rỗng
          
          return { questionText, options };
        });
        
        console.log(`Câu hỏi: ${questionData.questionText}`);
        console.log(`Các lựa chọn: ${questionData.options.join(', ')}`);
        
        // Kiểm tra xem câu hỏi này đã được xử lý chưa (tránh lưu trùng lặp khi reattempt)
        const questionKey = questionData.questionText;
        const isProcessed = processedQuestions.has(questionKey);
        
        if (isProcessed) {
          console.log('Câu hỏi này đã được xử lý trước đó (có thể là reattempt), bỏ qua lưu trữ');
        }
        
        // Chọn một đáp án - thử lần lượt các đáp án cho đến khi thành công
        try {
          await this.page.waitForSelector('button.option', { timeout: 8000 });
          const options = await this.page.$$('button.option');
          
          let clickSuccessful = false;
          
          if (options && options.length > 0) {
            // Thử bấm từng đáp án cho đến khi thành công
            for (let i = 0; i < options.length; i++) {
              try {
                if (options[i]) {
                  await options[i].click();
                  console.log(`Đã bấm vào đáp án thứ ${i+1}`);
                  clickSuccessful = true;
                  break;
                }
              } catch (individualClickError) {
                console.log(`Không thể bấm vào đáp án thứ ${i+1}, thử đáp án tiếp theo`);
              }
            }
            
            // Nếu vẫn không bấm được, thử phương pháp khác
            if (!clickSuccessful) {
              try {
                // Thử bấm bằng cách sử dụng selector trực tiếp
                await this.page.click('button.option');
                console.log('Đã bấm vào đáp án bằng phương pháp selector');
                clickSuccessful = true;
              } catch (selectorClickError) {
                console.log('Không thể bấm đáp án bằng phương pháp selector');
              }
            }
          } else {
            console.log('Không tìm thấy các phần tử đáp án hoặc mảng options trống');
            
            // Kiểm tra nếu đã kết thúc quiz
            const isCompleted = await this.page.evaluate(() => {
              return document.querySelector('.results-page, .quiz-completed, .game-over, .game-end') !== null;
            });
            
            if (isCompleted) {
              console.log('Đã phát hiện kết thúc quiz');
              isLastQuestion = true;
              break;
            }
          }
          
          // Nếu không thể bấm đáp án nào, nhưng vẫn có câu hỏi hiển thị
          if (!clickSuccessful) {
            console.log('Không thể bấm vào bất kỳ đáp án nào, đợi để tự động chuyển câu hỏi');
          }
        } catch (clickError) {
          console.error('Lỗi khi tìm và bấm đáp án:', clickError);
          
          // Kiểm tra thêm sau khi gặp lỗi
          try {
            const stillHasQuestion = await this.page.evaluate(() => {
              return document.querySelector('.question-text-color') !== null;
            });
            
            if (!stillHasQuestion) {
              console.log('Không còn câu hỏi sau khi gặp lỗi, có thể quiz đã kết thúc');
              isLastQuestion = true;
              break;
            }
          } catch (err) {
            // Bỏ qua lỗi khi kiểm tra
          }
        }
        
        // Đợi một chút để xem kết quả
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Thu thập đáp án đúng - trong giao diện mới có thể cần kiểm tra lớp CSS khác
        let correctAnswer = 'Không xác định được đáp án đúng';
        try {
          correctAnswer = await this.page.evaluate(() => {
            // Thử tìm đáp án đúng dựa trên lớp CSS
            const correctOptions = document.querySelectorAll('button.option.is-correct, button.option.correct');
            if (correctOptions.length > 0) {
              const textElement = correctOptions[0].querySelector('.resizeable');
              return textElement ? textElement.textContent.trim() : 'Không tìm thấy nội dung';
            }
            
            // Nếu không tìm thấy lớp CSS rõ ràng, thử tìm các phần tử có thể chỉ ra đáp án đúng
            const options = document.querySelectorAll('button.option');
            for (const option of options) {
              // Kiểm tra các thuộc tính có thể chỉ ra đáp án đúng
              if (option.classList.contains('is-correct') || 
                  option.classList.contains('correct') || 
                  option.style.backgroundColor === 'green' || 
                  option.querySelector('.correct-marker')) {
                const textElement = option.querySelector('.resizeable');
                return textElement ? textElement.textContent.trim() : 'Không tìm thấy nội dung';
              }
            }
            
            // Nếu không tìm thấy, trả về giá trị mặc định
            return 'Không xác định được đáp án đúng';
          });
        } catch (error) {
          console.error('Lỗi khi tìm đáp án đúng:', error);
        }
        
        console.log(`Đáp án đúng: ${correctAnswer}`);
        
        // Chỉ lưu câu hỏi nếu chưa được xử lý trước đó
        if (!isProcessed) {
          // Lưu thông tin câu hỏi
          this.quizData.questions.push({
            questionNumber: questionCount + 1,
            questionText: questionData.questionText,
            options: questionData.options,
            correctAnswer: correctAnswer
          });
          
          // Đánh dấu câu hỏi này đã được xử lý
          processedQuestions.add(questionKey);
          
          // Tăng số câu hỏi đã xử lý
          questionCount++;
        }
        
        // Chia thời gian đợi thành hai phần để kiểm tra giữa chừng
        console.log('Đợi 5 giây đầu tiên...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Kiểm tra giữa chừng xem có màn hình Reattempt không
        const midwayReattempt = await this.page.evaluate(() => {
          // Kiểm tra text "Reattempt"
          const reattemptText = document.querySelector('p.explanation');
          if (reattemptText && reattemptText.textContent.includes('Reattempt')) {
            return true;
          }
          
          // Kiểm tra sự hiện diện của các dot
          const dots = document.querySelectorAll('.dot-row .dot');
          if (dots.length > 0 && !document.querySelector('.question-text-color')) {
            return true;
          }
          
          return false;
        });
        
        if (midwayReattempt) {
          console.log('Phát hiện màn hình Reattempt giữa chừng!');
          
          // Tìm và bấm vào lựa chọn đầu tiên
          try {
            const dots = await this.page.$$('.dot');
            if (dots && dots.length > 0) {
              await dots[0].click();
              console.log('Đã bấm vào dot đầu tiên trong màn hình Reattempt giữa chừng');
            } else {
              await this.page.mouse.click(300, 300);
              console.log('Đã bấm vào vị trí cố định trong màn hình Reattempt giữa chừng');
            }
            
            // Đợi để chuyển sang câu hỏi tiếp theo
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          } catch (error) {
            console.error('Lỗi khi xử lý màn hình Reattempt giữa chừng:', error);
          }
        }
        
        console.log('Đợi 5 giây còn lại...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Kiểm tra sau khi đợi xem có còn đáp án hiển thị không hoặc có màn hình Reattempt không
        try {
          const finalState = await this.page.evaluate(() => {
            // Kiểm tra các đáp án
            const hasOptions = document.querySelectorAll('button.option').length > 0;
            
            // Kiểm tra màn hình Reattempt
            const reattemptText = document.querySelector('p.explanation');
            const isReattempt = reattemptText && reattemptText.textContent.includes('Reattempt');
            
            // Kiểm tra sự hiện diện của các dot
            const dots = document.querySelectorAll('.dot-row .dot');
            const hasDots = dots.length > 0 && !document.querySelector('.question-text-color');
            
            return { hasOptions, isReattempt, hasDots };
          });
          
          if (finalState.isReattempt || finalState.hasDots) {
            console.log('Phát hiện màn hình Reattempt sau thời gian đợi!');
            
            // Tìm và bấm vào lựa chọn đầu tiên
            try {
              const dots = await this.page.$$('.dot');
              if (dots && dots.length > 0) {
                await dots[0].click();
                console.log('Đã bấm vào dot đầu tiên');
              } else {
                await this.page.mouse.click(300, 300);
                console.log('Đã bấm vào vị trí cố định');
              }
              
              // Đợi để chuyển sang câu hỏi tiếp theo
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue;
            } catch (error) {
              console.error('Lỗi khi xử lý màn hình Reattempt cuối cùng:', error);
            }
          } else if (!finalState.hasOptions) {
            console.log('Sau khi đợi, không tìm thấy đáp án, có thể quiz đã kết thúc');
            isLastQuestion = true;
          }
        } catch (error) {
          console.log('Lỗi khi kiểm tra đáp án sau thời gian đợi:', error);
        }
        
      } catch (error) {
        console.error(`Lỗi khi xử lý phần tử ${questionCount + 1}:`, error);
        
        // Kiểm tra nếu không còn câu hỏi
        try {
          const hasQuestion = await this.page.evaluate(() => {
            return document.querySelector('.question-text-color') !== null;
          });
          
          if (!hasQuestion) {
            // Kiểm tra xem có phải là màn hình Reattempt không
            const mightBeReattempt = await this.page.evaluate(() => {
              const reattemptText = document.querySelector('p.explanation');
              if (reattemptText && reattemptText.textContent.includes('Reattempt')) {
                return true;
              }
              
              const dots = document.querySelectorAll('.dot-row .dot');
              if (dots.length > 0) {
                return true;
              }
              
              return false;
            });
            
            if (mightBeReattempt) {
              console.log('Có thể là màn hình Reattempt sau khi gặp lỗi, thử bấm vào dot...');
              
              try {
                const dots = await this.page.$$('.dot');
                if (dots && dots.length > 0) {
                  await dots[0].click();
                  console.log('Đã bấm vào dot sau khi gặp lỗi');
                } else {
                  await this.page.mouse.click(300, 300);
                  console.log('Đã bấm vào vị trí cố định sau khi gặp lỗi');
                }
                
                // Đợi để chuyển sang câu hỏi tiếp theo
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
              } catch (clickError) {
                console.error('Lỗi khi bấm vào dot sau khi gặp lỗi:', clickError);
              }
            } else {
              console.log('Không tìm thấy câu hỏi, có thể quiz đã kết thúc');
              isLastQuestion = true;
            }
          } else {
            // Đợi và tiếp tục với câu hỏi tiếp theo
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (evalError) {
          console.log('Lỗi khi kiểm tra câu hỏi:', evalError);
          isLastQuestion = true;
        }
      }
    }
  
    // Hủy timeout khi kết thúc
    if (this.quizTimeout) {
      clearTimeout(this.quizTimeout);
    }
  }
  
  // Thiết lập timeout tự động
  startQuizTimeout() {
    // Xóa timeout cũ nếu có
    if (this.quizTimeout) {
      clearTimeout(this.quizTimeout);
    }
    
    // Đặt timeout mới
    this.quizTimeout = setTimeout(async () => {
      console.log('Đã vượt quá thời gian tối đa cho quiz, đang kết thúc...');
      try {
        // Xuất dữ liệu đã thu thập được
        if (this.quizData.questions.length > 0) {
          await this.exportToWord();
        }
      } catch (error) {
        console.error('Lỗi khi xuất dữ liệu:', error);
      } finally {
        // Đóng trình duyệt
        await this.close();
        process.exit(1);
      }
    }, this.maxQuizDuration);
  }

  // Tạo file text tạm thời từ dữ liệu thu thập được
  async createTempTextFile() {
    try {
      console.log('Tạo file text tạm thời từ dữ liệu...');
      let textContent = `${this.quizData.title || 'Quizizz Quiz'}\n\n`;
      
      for (const question of this.quizData.questions) {
        let questionText = question.questionText;
        const questionNumberMatch = questionText.match(/^Câu \d+:/);
        if (questionNumberMatch) {
          questionText = questionText.replace(questionNumberMatch[0], '').trim();
        }
        
        textContent += `Câu ${question.questionNumber}: ${questionText}\n\n`;
        
        const options = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        for (let i = 0; i < question.options.length; i++) {
          const option = question.options[i];
          const optionLetter = i < options.length ? options[i] : `Lựa chọn ${i+1}`;
          const isCorrect = option === question.correctAnswer;
          
          if (isCorrect) {
            textContent += `${optionLetter}. ${option} (ĐÁP ÁN ĐÚNG)\n`;
          } else {
            textContent += `${optionLetter}. ${option}\n`;
          }
        }
        
        textContent += '\n';
      }
      
      const tempFilename = `quizizz_temp_${Date.now()}.txt`;
      fs.writeFileSync(tempFilename, textContent);
      console.log(`Đã tạo file text tạm thời: ${tempFilename}`);
      return tempFilename;
    } catch (error) {
      console.error('Lỗi khi tạo file text tạm thời:', error);
      return null;
    }
  }

  // Chuyển đổi từ text sang Word với định dạng đẹp
  async convertTextToWord(inputFile, outputFile) {
    try {
      console.log(`Đang chuyển đổi từ ${inputFile} sang ${outputFile}...`);
      const content = fs.readFileSync(inputFile, 'utf8');
      
      // Phân tích nội dung file text
      const lines = content.split('\n');
      let title = 'Quizizz Quiz';
      
      // Lấy tiêu đề từ dòng đầu tiên
      if (lines.length > 0) {
        title = lines[0].trim();
      }
      
      // Tạo mảng chứa tất cả paragraphs
      const children = [];
      
      // Thêm tiêu đề với font Times New Roman, size 14, bold
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 28, // 14pt = 28 half-points
              font: "Times New Roman"
            })
          ],
          heading: HeadingLevel.HEADING_1
        })
      );
      
      // Biến để theo dõi vị trí hiện tại
      let currentQuestion = '';
      let inQuestion = false;
      
      // Xử lý từng dòng
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Bỏ qua dòng trống
        if (line === '') {
          children.push(new Paragraph({}));
          continue;
        }
        
        // Kiểm tra nếu dòng bắt đầu bằng "Câu X:"
        if (line.match(/^Câu \d+:/)) {
          inQuestion = true;
          currentQuestion = line;
          
          // Thêm tiêu đề câu hỏi với font Times New Roman, size 12
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: currentQuestion,
                  bold: true,
                  size: 28, // 12pt = 24 half-points
                  color: "000000",
                  font: "Times New Roman"
                })
              ],
              heading: HeadingLevel.HEADING_2
            })
          );
          
          // Thêm dòng trống sau câu hỏi
          children.push(new Paragraph({}));
        } 
        // Kiểm tra nếu dòng là đáp án
        else if (inQuestion && line.match(/^[A-H]\./)) {
          const isCorrect = line.includes('(ĐÁP ÁN ĐÚNG)');
          
          // Loại bỏ phần "(ĐÁP ÁN ĐÚNG)" nếu có
          let cleanLine = line;
          if (isCorrect) {
            cleanLine = line.replace('(ĐÁP ÁN ĐÚNG)', '').trim();
          }
          
          // Thêm đáp án vào document với font Times New Roman, size 12
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cleanLine,
                  bold: isCorrect,
                  highlight: isCorrect ? 'yellow' : undefined,
                  size: 28, // 12pt = 24 half-points
                  font: "Times New Roman"
                })
              ]
            })
          );
        }
        // Dòng khác
        else if (inQuestion) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 28, // 12pt = 24 half-points
                  font: "Times New Roman"
                })
              ]
            })
          );
        }
      }
      
      // Tạo document với cách đơn giản nhất
      const doc = new Document({
        features: {
          updateFields: false
        },
        styles: {
          default: {
            document: {
              run: {
                font: "Times New Roman",
                size: 28 // 12pt = 24 half-points
              }
            },
            paragraphStyles: [
              {
                id: "Heading1",
                name: "Heading 1",
                basedOn: "Normal",
                next: "Normal",
                run: {
                  font: "Times New Roman",
                  size: 28, // 14pt = 28 half-points
                  bold: true
                }
              },
              {
                id: "Heading2",
                name: "Heading 2",
                basedOn: "Normal",
                next: "Normal",
                run: {
                  font: "Times New Roman",
                  size: 28, // 12pt = 24 half-points
                  bold: true
                }
              }
            ]
          }
        },
        sections: [
          {
            children: children
          }
        ]
      });
      
      // Lưu file Word
      console.log(`Đang tạo file Word ${outputFile}...`);
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(outputFile, buffer);
      
      console.log(`Đã chuyển đổi thành công sang file: ${outputFile}`);
      
      // Xóa file text tạm thời
      if (fs.existsSync(inputFile) && inputFile.includes('quizizz_temp_')) {
        fs.unlinkSync(inputFile);
        console.log(`Đã xóa file tạm thời: ${inputFile}`);
      }
      
      return true;
    } catch (error) {
      console.error('Lỗi khi chuyển đổi file:', error);
      
      // Thử cách khác - phiên bản đơn giản hơn
      try {
        console.log('Thử cách khác: Tạo file Word mới với định dạng đơn giản hơn...');
        
        // Phương pháp 2: Sử dụng cách khởi tạo khác
        const doc2 = new Document();
        const paragraphs = [];
        
        // Phân tích nội dung file text
        const lines = content.split('\n');
        
        // Xử lý từng dòng
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line === '') {
            paragraphs.push(new Paragraph({}));
            continue;
          }
          
          // Kiểm tra nếu là tiêu đề (dòng đầu tiên)
          if (i === 0) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    bold: true,
                    size: 28,
                    font: "Times New Roman"
                  })
                ],
                heading: HeadingLevel.HEADING_1
              })
            );
          }
          // Kiểm tra nếu là câu hỏi (bắt đầu với "Câu X:")
          else if (line.match(/^Câu \d+:/)) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    bold: true,
                    size: 28,
                    font: "Times New Roman"
                  })
                ],
                heading: HeadingLevel.HEADING_2
              })
            );
            paragraphs.push(new Paragraph({}));
          }
          // Kiểm tra nếu là đáp án đúng
          else if (line.includes('(ĐÁP ÁN ĐÚNG)')) {
            const cleanLine = line.replace('(ĐÁP ÁN ĐÚNG)', '').trim();
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: cleanLine,
                    bold: true,
                    highlight: 'yellow',
                    size: 28,
                    font: "Times New Roman"
                  })
                ]
              })
            );
          }
          // Đáp án thường
          else if (line.match(/^[A-H]\./)) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    size: 28,
                    font: "Times New Roman"
                  })
                ]
              })
            );
          }
          // Các dòng khác
          else {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    size: 28,
                    font: "Times New Roman"
                  })
                ]
              })
            );
          }
        }
        
        doc2.addSection({
          children: paragraphs
        });
        
        const buffer2 = await Packer.toBuffer(doc2);
        fs.writeFileSync(outputFile, buffer2);
        
        console.log(`Đã tạo file Word đơn giản: ${outputFile}`);
        
        // Xóa file text tạm thời
        if (fs.existsSync(inputFile) && inputFile.includes('quizizz_temp_')) {
          fs.unlinkSync(inputFile);
          console.log(`Đã xóa file tạm thời: ${inputFile}`);
        }
        
        return true;
      } catch (error2) {
        console.error('Lỗi khi thử phương pháp thay thế:', error2);
        return false;
      }
    }
  }

  // Xuất dữ liệu sang file Word
  async exportToWord() {
    console.log('Xuất dữ liệu ra file Word...');
    
    try {
      // Kiểm tra xem có câu hỏi nào không
      if (!this.quizData.questions || this.quizData.questions.length === 0) {
        console.log('Không có dữ liệu câu hỏi để xuất');
        return;
      }
      
      // Tạo file text tạm thời
      const tempTextFile = await this.createTempTextFile();
      
      if (!tempTextFile) {
        throw new Error('Không thể tạo file text tạm thời');
      }
      
      // Đặt tên file Word đầu ra
      const outputFile = tempTextFile.replace('.txt', '.docx');
      
      // Chuyển đổi file text sang Word
      const success = await this.convertTextToWord(tempTextFile, outputFile);
      
      if (success) {
        console.log(`Đã xuất dữ liệu thành công vào file: ${outputFile}`);
      } else {
        console.error('Không thể chuyển đổi dữ liệu sang file Word');
      }
    } catch (error) {
      console.error('Lỗi khi xuất file Word:', error);
      
      // Thử xuất ra text file nếu xuất Word thất bại
      try {
        console.log('Thử xuất ra file text...');
        let textContent = `${this.quizData.title || 'Quizizz Quiz'}\n\n`;
        
        for (const question of this.quizData.questions) {
          // Xử lý câu hỏi để loại bỏ phần "Câu X:" ở đầu nếu có
          let questionText = question.questionText;
          const questionNumberMatch = questionText.match(/^Câu \d+:/);
          if (questionNumberMatch) {
            questionText = questionText.replace(questionNumberMatch[0], '').trim();
          }
          
          textContent += `Câu ${question.questionNumber}: ${questionText}\n\n`;
          
          const options = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          for (let i = 0; i < question.options.length; i++) {
            const option = question.options[i];
            const optionLetter = i < options.length ? options[i] : `Lựa chọn ${i+1}`;
            const isCorrect = option === question.correctAnswer;
            
            if (isCorrect) {
              textContent += `${optionLetter}. ${option} (ĐÁP ÁN ĐÚNG)\n`;
            } else {
              textContent += `${optionLetter}. ${option}\n`;
            }
          }
          
          textContent += '\n';
        }
        
        const filename = `quizizz_${Date.now()}.txt`;
        fs.writeFileSync(filename, textContent);
        console.log(`Đã lưu file Text: ${filename}`);
      } catch (textError) {
        console.error('Lỗi khi xuất file text:', textError);
      }
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Đã đóng trình duyệt');
    }
  }
}

// Hàm chuyển đổi từ file txt có sẵn sang Word
async function convertExistingTextToWord(inputFile, outputFile) {
  console.log(`Chuyển đổi file ${inputFile} có sẵn sang Word...`);
  
  try {
    // Kiểm tra xem file đầu vào tồn tại không
    if (!fs.existsSync(inputFile)) {
      console.error(`Lỗi: File ${inputFile} không tồn tại!`);
      return false;
    }
    
    // Nếu không chỉ định tên file đầu ra
    if (!outputFile) {
      outputFile = inputFile.replace('.txt', '.docx');
    }
    
    // Tạo một instance của QuizizzScraper chỉ để sử dụng phương thức convertTextToWord
    const converter = new QuizizzScraper();
    const result = await converter.convertTextToWord(inputFile, outputFile);
    
    return result;
  } catch (error) {
    console.error('Lỗi khi chuyển đổi file text có sẵn:', error);
    return false;
  }
}

// Hàm main để xử lý tham số dòng lệnh
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
=========== QUIZIZZ SCRAPER ===========
Công cụ thu thập câu hỏi và đáp án từ Quizizz

Sử dụng:
1. Thu thập từ game Quizizz:
   node quizizz-scraper.js join <mã-game-hoặc-URL>
   Ví dụ: node quizizz-scraper.js join 12345678
   Ví dụ: node quizizz-scraper.js join https://quizizz.com/join?gc=12345678

2. Chuyển đổi file text có sẵn sang Word:
   node quizizz-scraper.js convert <input-file.txt> [output-file.docx]
   Ví dụ: node quizizz-scraper.js convert quizizz_1234567890.txt

3. Chạy ở chế độ headless (không hiện trình duyệt):
   node quizizz-scraper.js join <mã-game> --headless
    
Các tùy chọn:
--headless     : Chạy ẩn trình duyệt
--timeout=<số> : Thời gian tối đa chạy (phút)
--name=<tên>   : Đặt tên người chơi

Hỗ trợ:
Tác giả: Tích hợp từ scraper.js và txt-to-word.js
`);
    return;
  }
  
  const command = args[0].toLowerCase();
  
  // Phân tích các tùy chọn
  const options = {
    headless: false,
    maxDuration: 15 * 60 * 1000, // 15 phút
    playerName: null
  };
  
  // Xử lý các tùy chọn
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--headless') {
      options.headless = true;
    } else if (arg.startsWith('--timeout=')) {
      const minutes = parseInt(arg.split('=')[1]);
      if (!isNaN(minutes) && minutes > 0) {
        options.maxDuration = minutes * 60 * 1000;
      }
    } else if (arg.startsWith('--name=')) {
      options.playerName = arg.split('=')[1];
    }
  }
  
  if (command === 'join') {
    // Thu thập từ game Quizizz
    if (args.length < 2) {
      console.error('Thiếu mã game hoặc URL!');
      console.error('Sử dụng: node quizizz-scraper.js join <mã-game-hoặc-URL>');
      return;
    }
    
    const gameCode = args[1];
    
    try {
      const scraper = new QuizizzScraper({
        headless: options.headless,
        maxDuration: options.maxDuration
      });
      
      await scraper.initialize();
      await scraper.joinGame(gameCode, options.playerName);
      await scraper.close();
    } catch (error) {
      console.error('Lỗi khi chạy chương trình:', error);
    }
  } else if (command === 'convert') {
    // Chuyển đổi file text có sẵn sang Word
    if (args.length < 2) {
      console.error('Thiếu tên file đầu vào!');
      console.error('Sử dụng: node quizizz-scraper.js convert <input-file.txt> [output-file.docx]');
      return;
    }
    
    const inputFile = args[1];
    let outputFile = args.length >= 3 ? args[2] : inputFile.replace('.txt', '.docx');
    
    const result = await convertExistingTextToWord(inputFile, outputFile);
    
    if (result) {
      console.log('Quá trình chuyển đổi hoàn tất.');
    } else {
      console.error('Lỗi trong quá trình chuyển đổi.');
    }
  } else {
    console.error(`Lệnh không hợp lệ: ${command}`);
    console.error('Sử dụng: node quizizz-scraper.js join <mã-game> hoặc node quizizz-scraper.js convert <input-file.txt>');
  }
}

// Chạy chương trình
main();