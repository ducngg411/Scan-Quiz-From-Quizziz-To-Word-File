const fs = require('fs');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

// Hàm chính để chuyển đổi file text sang Word
async function convertTxtToWord(inputFile, outputFile) {
  try {
    console.log(`Đang đọc file ${inputFile}...`);
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
                size: 28, // 12pt = 28 half-points
                color: "000000",
                font: "Times New Roman",
                
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
                size: 28, // 12pt = 28 half-points
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
                size: 28, // 12pt = 28 half-points
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
              size: 28 // 12pt = 28 half-points
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
                size: 28, // 12pt = 28 half-points
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
    return true;
  } catch (error) {
    console.error('Lỗi khi chuyển đổi file:', error);
    
    // Thử cách khác - phiên bản đơn giản hơn
    try {
      console.log('Thử cách khác: Tạo file Word mới với định dạng đơn giản hơn...');
      
      // Phương pháp 2: Sử dụng cách khởi tạo khác
      const doc2 = new Document();
      
      // Thiết lập styles mặc định
      doc2.Styles.createParagraphStyle("MyHeading1", "My Heading 1")
        .basedOn("Normal")
        .font("Times New Roman")
        .size(28) // 14pt
        .bold();
      
      doc2.Styles.createParagraphStyle("MyNormal", "My Normal")
        .font("Times New Roman")
        .size(28); // 12pt
        
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
              style: "MyHeading1"
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
              ]
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
              ],
              style: "MyNormal"
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
              ],
              style: "MyNormal"
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
              ],
              style: "MyNormal"
            })
          );
        }
      }
      
      doc2.addSection({
        children: paragraphs
      });
      
      const buffer2 = await Packer.toBuffer(doc2);
      const alternativeOutput = outputFile.replace('.docx', '_simple.docx');
      fs.writeFileSync(alternativeOutput, buffer2);
      
      console.log(`Đã tạo file Word đơn giản: ${alternativeOutput}`);
      return true;
    } catch (error2) {
      console.error('Lỗi khi thử phương pháp thay thế:', error2);
      
      // Cuối cùng thử xuất file text với định dạng đơn giản
      try {
        console.log('Thử xuất ra file text đánh dấu...');
        let textContent = `${title}\n\n`;
        
        // Phân tích từng dòng
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line === '') {
            textContent += '\n';
            continue;
          }
          
          // Kiểm tra nếu là đáp án đúng
          if (line.includes('(ĐÁP ÁN ĐÚNG)')) {
            const cleanLine = line.replace('(ĐÁP ÁN ĐÚNG)', '').trim();
            textContent += `${cleanLine} [ĐÁP ÁN ĐÚNG - BÔI VÀNG]\n`;
          } else {
            textContent += `${line}\n`;
          }
        }
        
        const textOutput = outputFile.replace('.docx', '_formatted.txt');
        fs.writeFileSync(textOutput, textContent);
        console.log(`Đã lưu file text có đánh dấu: ${textOutput}`);
        return true;
      } catch (error3) {
        console.error('Lỗi khi xuất file text:', error3);
        return false;
      }
    }
  }
}

// Hàm main để xử lý tham số dòng lệnh
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Sử dụng: node txt-to-word.js <input-file.txt> [output-file.docx]');
    console.log('Ví dụ: node txt-to-word.js quizizz_1234567890.txt');
    return;
  }
  
  const inputFile = args[0];
  let outputFile = inputFile.replace('.txt', '.docx');
  
  // Nếu người dùng chỉ định tên file đầu ra
  if (args.length >= 2) {
    outputFile = args[1];
  }
  
  // Kiểm tra xem file đầu vào tồn tại không
  if (!fs.existsSync(inputFile)) {
    console.error(`Lỗi: File ${inputFile} không tồn tại!`);
    return;
  }
  
  const result = await convertTxtToWord(inputFile, outputFile);
  
  if (result) {
    console.log('Quá trình chuyển đổi hoàn tất.');
  } else {
    console.error('Lỗi trong quá trình chuyển đổi.');
  }
}

// Chạy chương trình
main();