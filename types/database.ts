export interface Meeting {
  id: number;
  meeting_number: number;
  title: string;
  created_at: string;
}

export interface Choice {
  id: number;
  question_id: number;
  choice_label: 'A' | 'B' | 'C' | 'D';
  choice_text: string;
  is_correct: boolean;
}

export interface Question {
  id: number;
  meeting_id: number;
  question_text: string;
  question_order: number;
  choices?: Choice[];
}

export interface EssayQuestion {
  id: number;
  meeting_id: number;
  question_text: string;
  created_at: string;
}

export interface Student {
  id: number;
  name: string;
  class_name: string;
  created_at: string;
}

export interface QuizAttempt {
  id: number;
  student_id: number;
  meeting_id: number;
  score: number | null;
  submitted_at: string;
  students?: Student;
  meetings?: Meeting;
}

export interface Answer {
  id: number;
  attempt_id: number;
  question_id: number;
  choice_id: number;
  choices?: Choice;
  questions?: Question;
}

export interface EssayAnswer {
  id: number;
  attempt_id: number;
  essay_question_id: number;
  answer_text: string;
  created_at: string;
  essay_questions?: EssayQuestion;
}
