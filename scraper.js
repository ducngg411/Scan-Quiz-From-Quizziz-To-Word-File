// Quizizz Scraper - Thu thập câu hỏi và đáp án
// Sử dụng Node.js với các thư viện puppeteer và docx

const puppeteer = require('puppeteer');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const fs = require('fs');

class QuizizzScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.quizTimeout = null;
    this.maxQuizDuration = 15 * 60 * 1000; // 15 phút tối đa
    this.quizData = {
      title: '',
      questions: []
    };
  }

  async initialize() {
    console.log('Khởi tạo trình duyệt...');
    this.browser = await puppeteer.launch({
      headless: false, // Đặt true để chạy ngầm
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
  
  // Thêm phương thức mới để thiết lập timeout tự động
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

  async exportToWord() {
    console.log('Xuất dữ liệu ra file Word...');
    
    try {
      // Kiểm tra xem có câu hỏi nào không
      if (!this.quizData.questions || this.quizData.questions.length === 0) {
        console.log('Không có dữ liệu câu hỏi để xuất');
        return;
      }
      
      // Sử dụng cách đơn giản nhất để tạo document, tránh các lỗi liên quan đến creator
      const doc = new Document({
        creator: "Quizizz Scraper",
        description: "Quizizz Quiz Data",
        title: this.quizData.title || "Quizizz Quiz"
      });
      
      // Tạo một đoạn với tiêu đề
      doc.addParagraph(
        new Paragraph({
          text: this.quizData.title || 'Quizizz Quiz',
          heading: HeadingLevel.HEADING_1
        })
      );
      
      // Thêm các câu hỏi vào document
      for (const question of this.quizData.questions) {
        // Tiêu đề câu hỏi - bỏ phần "Câu X:" ở trong nội dung câu hỏi nếu có
        let questionText = question.questionText;
        const questionNumberMatch = questionText.match(/^Câu \d+:/);
        if (questionNumberMatch) {
          questionText = questionText.replace(questionNumberMatch[0], '').trim();
        }
        
        doc.addParagraph(
          new Paragraph({
            text: `Câu ${question.questionNumber}: ${questionText}`,
            heading: HeadingLevel.HEADING_2
          })
        );
        
        // Thêm dòng trống sau câu hỏi
        doc.addParagraph(new Paragraph({}));
        
        // Các lựa chọn
        const options = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        for (let i = 0; i < question.options.length; i++) {
          const option = question.options[i];
          const optionLetter = i < options.length ? options[i] : `Lựa chọn ${i+1}`;
          const isCorrect = option === question.correctAnswer;
          
          doc.addParagraph(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${optionLetter}. ${option}`,
                  bold: isCorrect,
                  highlight: isCorrect ? 'yellow' : undefined // Bôi vàng đáp án đúng
                })
              ]
            })
          );
        }
        
        // Khoảng trống
        doc.addParagraph(new Paragraph({}));
      }
      
      // Tạo buffer và lưu file
      try {
        const buffer = await Packer.toBuffer(doc);
        const filename = `quizizz_${Date.now()}.docx`;
        
        fs.writeFileSync(filename, buffer);
        console.log(`Đã lưu file Word: ${filename}`);
      } catch (packError) {
        console.error('Lỗi khi đóng gói file Word:', packError);
        throw packError; // Ném lỗi để xử lý ở catch bên ngoài
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

// Chạy chương trình
async function run() {
  const gameCode = process.argv[2] || '';
  
  if (!gameCode) {
    console.error('Vui lòng cung cấp mã game hoặc URL Quizizz!');
    console.error('Ví dụ: node scraper.js https://quizizz.com/join?gc=40358948');
    process.exit(1);
  }
  
  const scraper = new QuizizzScraper();
  
  try {
    await scraper.initialize();
    await scraper.joinGame(gameCode);
  } catch (error) {
    console.error('Lỗi khi chạy chương trình:', error);
  } finally {
    await scraper.close();
  }
}

// Chạy
run();