// Calculate grade based on score
const calculateGrade = (score) => {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D+';
  if (score >= 20) return 'D';
  return 'E';
};

// Calculate grade point
const calculateGradePoint = (averageScore) => {
  if (averageScore >= 80) return 'A';
  if (averageScore >= 70) return 'B+';
  if (averageScore >= 60) return 'B';
  if (averageScore >= 50) return 'C+';
  if (averageScore >= 40) return 'C';
  if (averageScore >= 30) return 'D+';
  if (averageScore >= 20) return 'D';
  return 'E';
};

module.exports = {
  calculateGrade,
  calculateGradePoint
};