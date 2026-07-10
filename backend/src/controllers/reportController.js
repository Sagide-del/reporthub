const fs = require('fs');
const csv = require('csv-parser');
const PDFDocument = require('pdfkit');
const Student = require('../models/Student');
const School = require('../models/School');
const { calculateGrade, calculateGradePoint } = require('../utils/helpers');

// Import results from CSV
exports.importResults = async (req, res) => {
  try {
    const { term, academicYear, grade, stream } = req.body;
    const filePath = req.file.path;
    
    const subjects = ['Mathematics', 'Biology', 'Chemistry', 'Physics', 'English', 'Kiswahili', 'CRE', 'Geography', 'Business', 'History'];
    const results = [];
    
    // Parse CSV
    const parseCSV = () => {
      return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            const studentData = {
              admissionNumber: row.AdmissionNumber,
              firstName: row.FirstName,
              lastName: row.LastName,
              subjects: subjects.map(sub => {
                const cat1 = parseFloat(row[`${sub}_CAT1`]) || 0;
                const cat2 = parseFloat(row[`${sub}_CAT2`]) || 0;
                const endTerm = parseFloat(row[`${sub}_END`]) || 0;
                const averageCat = (cat1 + cat2) / 2;
                const finalScore = (averageCat * 0.3) + (endTerm * 0.7);
                
                return {
                  name: sub,
                  cat1,
                  cat2,
                  endTerm,
                  averageCat,
                  finalScore: Math.round(finalScore * 100) / 100,
                  grade: calculateGrade(finalScore),
                  teacherComment: ''
                };
              })
            };
            data.push(studentData);
          })
          .on('end', () => resolve(data))
          .on('error', (error) => reject(error));
      });
    };
    
    const studentsData = await parseCSV();
    
    // Save students and calculate rankings
    const savedStudents = [];
    for (const studentData of studentsData) {
      const totalScore = studentData.subjects.reduce((sum, sub) => sum + sub.finalScore, 0);
      const averageScore = totalScore / subjects.length;
      
      let student = await Student.findOne({
        schoolId: req.schoolId,
        admissionNumber: studentData.admissionNumber,
        term,
        academicYear
      });
      
      if (student) {
        student.firstName = studentData.firstName;
        student.lastName = studentData.lastName;
        student.grade = grade;
        student.stream = stream;
        student.results.subjects = studentData.subjects;
        student.results.totalScore = totalScore;
        student.results.averageScore = averageScore;
      } else {
        student = new Student({
          schoolId: req.schoolId,
          admissionNumber: studentData.admissionNumber,
          firstName: studentData.firstName,
          lastName: studentData.lastName,
          grade,
          stream,
          term,
          academicYear,
          results: {
            subjects: studentData.subjects,
            totalScore,
            averageScore,
            position: 0,
            totalStudents: 0,
            gradePoint: calculateGradePoint(averageScore)
          }
        });
      }
      
      await student.save();
      savedStudents.push(student);
    }
    
    // Update positions
    const sortedStudents = savedStudents.sort((a, b) => b.results.averageScore - a.results.averageScore);
    sortedStudents.forEach((student, index) => {
      student.results.position = index + 1;
      student.results.totalStudents = sortedStudents.length;
      student.save();
    });
    
    // Clean up file
    fs.unlinkSync(filePath);
    
    res.json({
      message: 'Results imported successfully!',
      totalStudents: savedStudents.length
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Generate report card for a student
exports.generateReportCard = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.studentId,
      schoolId: req.schoolId
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const school = await School.findById(req.schoolId);
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `report-${student.admissionNumber}-${student.term}-${student.academicYear}.pdf`;
    const filepath = `uploads/${filename}`;
    
    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);
    
    // School Logo - With error handling
    if (school.logo && fs.existsSync(school.logo)) {
      try {
        // Check if it's a valid image
        const stats = fs.statSync(school.logo);
        if (stats.size > 0) {
          doc.image(school.logo, 50, 45, { width: 80, height: 80, fit: [80, 80] });
        }
      } catch (error) {
        console.error('Logo error:', error.message);
        // Continue without logo
      }
    }
    
    // School Header
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text(school.schoolName, 0, 50, { align: 'center' });
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Address: ${school.address?.street || ''}, ${school.address?.city || ''}, ${school.address?.county || ''}`, { align: 'center' });
    doc.text(`Email: ${school.email} | Phone: ${school.phone}`, { align: 'center' });
    
    // Report Title
    doc.moveDown();
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text(`${student.term} Report Card - ${student.academicYear}`, { align: 'center' });
    
    // Student Details
    doc.moveDown();
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(`Name: ${student.firstName} ${student.lastName}`, 50);
    doc.text(`Admission Number: ${student.admissionNumber}`, 300);
    doc.text(`Grade: ${student.grade} ${student.stream}`, 50);
    doc.text(`Overall Grade: ${student.results.gradePoint}`, 300);
    doc.text(`Position: ${student.results.position}/${student.results.totalStudents}`, 50);
    
    // Results Table
    doc.moveDown();
    const tableTop = doc.y;
    const subjects = student.results.subjects;
    
    // Table Headers
    doc.font('Helvetica-Bold');
    const headers = ['Subject', 'CAT 1', 'CAT 2', 'Avg CAT (30%)', 'End Term (70%)', 'Final Score', 'Grade'];
    const colWidths = [70, 45, 45, 60, 60, 60, 40];
    let xPosition = 50;
    
    headers.forEach((header, i) => {
      doc.text(header, xPosition, tableTop, { width: colWidths[i], align: 'center' });
      xPosition += colWidths[i];
    });
    
    let yPosition = tableTop + 20;
    
    // Table Content
    doc.font('Helvetica');
    subjects.forEach(sub => {
      xPosition = 50;
      const rowData = [
        sub.name,
        sub.cat1.toFixed(1),
        sub.cat2.toFixed(1),
        sub.averageCat.toFixed(1),
        sub.endTerm.toFixed(1),
        sub.finalScore.toFixed(1),
        sub.grade
      ];
      
      rowData.forEach((data, i) => {
        doc.text(String(data), xPosition, yPosition, { width: colWidths[i], align: 'center' });
        xPosition += colWidths[i];
      });
      
      yPosition += 20;
    });
    
    // Teacher's Comments
    doc.moveDown(2);
    doc.font('Helvetica-Bold')
       .text('Teacher\'s Comments:', 50);
    doc.font('Helvetica')
       .text('______________________________________________________________________________', 50);
    doc.text('______________________________________________________________________________', 50);
    
    // Principal's Comments
    doc.moveDown(2);
    doc.font('Helvetica-Bold')
       .text('Principal\'s Comments:', 50);
    doc.font('Helvetica')
       .text('______________________________________________________________________________', 50);
    doc.text('______________________________________________________________________________', 50);
    
    // Footer
    doc.moveDown(2);
    doc.fontSize(8)
       .text(`Generated on: ${new Date().toLocaleDateString()} | Report Hub System`, { align: 'center' });
    
    doc.end();
    
    writeStream.on('finish', () => {
      res.download(filepath, filename, (err) => {
        if (err) console.error('Download error:', err);
        fs.unlinkSync(filepath);
      });
    });
    
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: error.message });
  }
};