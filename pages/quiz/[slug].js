import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Head from 'next/head'

export default function QuizPage() {
  const router = useRouter()
  const { slug } = router.query  // URL 파라미터 이름은 slug이지만 실제로는 id를 받음
  
  // 퀴즈 기본 정보
  const [quizSet, setQuizSet] = useState(null)
  const [totalQuestionCount, setTotalQuestionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // 퀴즈 진행 상태
  const [gameState, setGameState] = useState('setup') // 'setup', 'playing', 'finished'
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showResult, setShowResult] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [attemptId, setAttemptId] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  
  // 타이머
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0) {
      handleTimeUp()
    }
  }, [timeLeft, gameState])

  // 퀴즈 기본 정보만 로드
  useEffect(() => {
    if (slug) {
      fetchQuizInfo()
    }
  }, [slug])

  const fetchQuizInfo = async () => {
    try {
      setLoading(true)
      setError(null)

      // 퀴즈 세트 정보 가져오기 (slug이 UUID 형식이면 id로, 아니면 slug로 검색)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
      
      const { data: quizData, error: quizError } = await supabase
        .from('quiz_sets')
        .select(`
          *,
          quiz_categories (
            name,
            color,
            icon
          )
        `)
        .eq(isUUID ? 'id' : 'slug', slug)
        .eq('is_published', true)
        .single()

      if (quizError) throw quizError
      if (!quizData) {
        setError('퀴즈를 찾을 수 없습니다.')
        return
      }

      setQuizSet(quizData)

      // 전체 질문 개수만 가져오기
      const { count, error: countError } = await supabase
        .from('quiz_questions')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_set_id', quizData.id)

      if (countError) throw countError
      setTotalQuestionCount(count || 0)
      
    } catch (error) {
      console.error('Error fetching quiz info:', error)
      setError('퀴즈를 불러오는 데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 무작위 질문 로드 (필요한 개수만)
  const loadRandomQuestions = async (questionCount) => {
    try {
      setQuestionsLoading(true)
      
      // 1. 모든 질문의 ID만 가져오기
      const { data: allIds, error: idsError } = await supabase
        .from('quiz_questions')
        .select('id')
        .eq('quiz_set_id', quizSet.id)
        .order('order_index')

      if (idsError) throw idsError

      // 2. 클라이언트에서 무작위 선택
      const shuffledIds = allIds
        .sort(() => Math.random() - 0.5)
        .slice(0, questionCount)
        .map(item => item.id)

      // 3. 선택된 ID의 질문만 상세 정보 로드
      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select(`
          *,
          quiz_options (
            *
          ),
          quiz_answers (
            *
          )
        `)
        .in('id', shuffledIds)

      if (questionsError) throw questionsError
      
      // 4. 무작위 순서 유지 (in 쿼리는 순서를 보장하지 않음)
      const questionsMap = new Map(questionsData.map(q => [q.id, q]))
      const orderedQuestions = shuffledIds
        .map(id => questionsMap.get(id))
        .filter(Boolean)
        .map(question => ({
          ...question,
          quiz_options: (question.quiz_options || []).sort((a, b) => a.order_index - b.order_index)
        }))
      
      setQuestions(orderedQuestions)
      return true
      
    } catch (error) {
      console.error('Error loading questions:', error)
      setError('질문을 불러오는 데 실패했습니다.')
      return false
    } finally {
      setQuestionsLoading(false)
    }
  }

  // 퀴즈 시작
  const startQuiz = async (questionCount) => {
    setSelectedQuestionCount(questionCount)
    
    // 선택한 개수만큼 무작위 질문 로드
    const success = await loadRandomQuestions(questionCount)
    if (!success) return
    
    // 시간 제한 설정
    if (quizSet.time_limit) {
      // 선택한 문제 수에 비례하여 시간 조정
      const timePerQuestion = Math.floor(quizSet.time_limit / totalQuestionCount)
      setTimeLeft(timePerQuestion * questionCount)
    }
    
    // 세션 ID 생성
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // quiz_attempts 레코드 생성 (비동기로 처리)
    supabase
      .from('quiz_attempts')
      .insert({
        quiz_set_id: quizSet.id,
        session_id: sessionId,
        started_at: new Date().toISOString()
      })
      .select()
      .single()
      .then(({ data }) => {
        if (data) setAttemptId(data.id)
      })
    
    setGameState('playing')
    setCurrentQuestionIndex(0)
    setAnswers({})
    setShowResult(false)
    setSelectedAnswer(null)
  }

  // 답변 처리
  const handleAnswer = useCallback((answer) => {
    if (showResult) return
    
    const currentQuestion = questions[currentQuestionIndex]
    let isCorrect = false
    let pointsEarned = 0
    
    // 정답 확인
    if (currentQuestion.question_type === 'multiple_choice') {
      const selectedOption = currentQuestion.quiz_options.find(opt => opt.id === answer)
      isCorrect = selectedOption?.is_correct || false
    } else if (currentQuestion.question_type === 'true_false') {
      const correctOption = currentQuestion.quiz_options.find(opt => opt.is_correct)
      isCorrect = answer === correctOption?.id
    } else if (currentQuestion.question_type === 'short_answer') {
      const correctAnswers = currentQuestion.quiz_answers || []
      isCorrect = correctAnswers.some(correctAns => {
        if (correctAns.is_case_sensitive) {
          return correctAns.is_exact_match 
            ? answer === correctAns.answer_text
            : answer.includes(correctAns.answer_text)
        } else {
          return correctAns.is_exact_match
            ? answer.toLowerCase() === correctAns.answer_text.toLowerCase()
            : answer.toLowerCase().includes(correctAns.answer_text.toLowerCase())
        }
      })
    }
    
    if (isCorrect) {
      pointsEarned = currentQuestion.points || 1
    }
    
    // 답변 저장
    setSelectedAnswer(answer)
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: {
        answer,
        isCorrect,
        pointsEarned
      }
    }))
    
    // 결과 즉시 표시
    setShowResult(true)
    
    // 서버에 비동기로 저장
    if (attemptId) {
      supabase
        .from('quiz_responses')
        .insert({
          attempt_id: attemptId,
          question_id: currentQuestion.id,
          selected_option_id: currentQuestion.question_type !== 'short_answer' ? answer : null,
          answer_text: currentQuestion.question_type === 'short_answer' ? answer : null,
          is_correct: isCorrect,
          points_earned: pointsEarned,
          answered_at: new Date().toISOString()
        })
        .then(() => {})
    }
  }, [showResult, questions, currentQuestionIndex, attemptId])

  // 다음 질문으로
  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setShowResult(false)
      setSelectedAnswer(null)
    } else {
      finishQuiz()
    }
  }, [currentQuestionIndex, questions.length])

  // 시간 초과 처리
  const handleTimeUp = () => {
    if (gameState === 'playing') {
      finishQuiz()
    }
  }

  // 퀴즈 종료
  const finishQuiz = async () => {
    setGameState('finished')
    
    // 점수 계산
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0)
    const earnedPoints = Object.values(answers).reduce((sum, ans) => sum + ans.pointsEarned, 0)
    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    
    // 비동기로 서버 업데이트
    if (attemptId) {
      supabase
        .from('quiz_attempts')
        .update({
          score: earnedPoints,
          total_points: totalPoints,
          percentage: percentage,
          completed: true,
          completed_at: new Date().toISOString(),
          time_spent: quizSet.time_limit ? 
            (Math.floor(quizSet.time_limit / totalQuestionCount) * selectedQuestionCount) - (timeLeft || 0) : null
        })
        .eq('id', attemptId)
        .then(() => {})
      
      supabase
        .from('quiz_sets')
        .update({ attempt_count: (quizSet.attempt_count || 0) + 1 })
        .eq('id', quizSet.id)
        .then(() => {})
    }
  }

  // 퀴즈 재시작 (새로운 무작위 질문)
  const restartQuiz = async () => {
    setGameState('setup')
    setAnswers({})
    setCurrentQuestionIndex(0)
    setShowResult(false)
    setSelectedAnswer(null)
    setQuestions([]) // 기존 질문 초기화
  }

  // 퀴즈 개수 옵션 생성
  const getQuestionCountOptions = () => {
    if (!totalQuestionCount) return []
    
    const options = []
    
    for (let i = 5; i <= totalQuestionCount; i += 5) {
      options.push(i)
    }
    
    if (totalQuestionCount % 5 !== 0) {
      options.push(totalQuestionCount)
    }
    
    if (totalQuestionCount < 5) {
      return [totalQuestionCount]
    }
    
    return options
  }

  // 시간 포맷
  const formatTime = (seconds) => {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 로딩 화면
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/quiz-list')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
          >
            목록으로
          </button>
        </div>
      </div>
    )
  }

  // 퀴즈 설정 화면
  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>{quizSet?.title || '퀴즈'}</title>
        </Head>
        
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              {quizSet?.thumbnail_image && (
                <img 
                  src={quizSet.thumbnail_image} 
                  alt={quizSet.title}
                  className="w-full h-40 object-cover rounded-lg mb-4"
                />
              )}
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{quizSet?.title}</h1>
              
              {quizSet?.description && (
                <p className="text-gray-600 text-sm">{quizSet.description}</p>
              )}
            </div>
            
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">문제 수 선택</h2>
              
              {questionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">준비 중...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {getQuestionCountOptions().map(count => (
                      <button
                        key={count}
                        onClick={() => startQuiz(count)}
                        className="p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                      >
                        <div className="text-xl font-bold text-gray-900">{count}문제</div>
                        {quizSet?.time_limit && (
                          <div className="text-xs text-gray-500">
                            {formatTime(Math.floor((quizSet.time_limit * count) / totalQuestionCount))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500 text-center">
                    전체 {totalQuestionCount}문제 • 합격 {quizSet?.pass_score || 70}%
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/quiz-list')}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← 목록으로
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 퀴즈 진행 화면
  if (gameState === 'playing') {
    const currentQuestion = questions[currentQuestionIndex]
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100
    const hasImage = currentQuestion?.question_image
    
    return (
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>{quizSet?.title}</title>
        </Head>
        
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* 헤더 */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-lg font-bold text-gray-900">
                {currentQuestionIndex + 1} / {questions.length}
              </span>
              {timeLeft !== null && (
                <span className={`text-lg font-mono ${timeLeft < 30 ? 'text-red-500' : 'text-gray-600'}`}>
                  {formatTime(timeLeft)}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-indigo-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* 콘텐츠 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* 질문/이미지 */}
            {hasImage || (showResult && currentQuestion?.explanation_image) ? (
              <div className="mb-6">
                <img 
                  src={showResult && currentQuestion?.explanation_image 
                    ? currentQuestion.explanation_image 
                    : currentQuestion.question_image}
                  alt={showResult && currentQuestion?.explanation_image ? "해설" : "문제"}
                  className="w-full h-48 object-contain rounded-lg mb-3"
                />
                <p className="text-lg text-gray-900 text-center">
                  {currentQuestion?.question_text}
                </p>
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-lg text-gray-900 text-center">
                  {currentQuestion?.question_text}
                </p>
              </div>
            )}
            
            {/* 답변 영역 */}
            {!showResult ? (
              <div className="space-y-3">
                {currentQuestion?.question_type === 'multiple_choice' && (
                  currentQuestion.quiz_options.map((option, index) => (
                    <button
                      key={option.id}
                      onClick={() => handleAnswer(option.id)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                    >
                      <div className="flex items-center">
                        <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-medium mr-3">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="text-gray-900">{option.option_text}</span>
                      </div>
                    </button>
                  ))
                )}
                
                {currentQuestion?.question_type === 'true_false' && (
                  currentQuestion.quiz_options.map(option => (
                    <button
                      key={option.id}
                      onClick={() => handleAnswer(option.id)}
                      className="w-full p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                    >
                      <span className="text-lg font-medium text-gray-900">{option.option_text}</span>
                    </button>
                  ))
                )}
                
                {currentQuestion?.question_type === 'short_answer' && (
                  <form onSubmit={(e) => {
                    e.preventDefault()
                    const answer = e.target.answer.value.trim()
                    if (answer) handleAnswer(answer)
                  }}>
                    <input
                      type="text"
                      name="answer"
                      placeholder="답을 입력하세요"
                      className="w-full p-4 border border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="mt-3 w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      제출
                    </button>
                  </form>
                )}
              </div>
            ) : (
              // 결과 표시
              <div>
                <div className={`p-4 rounded-lg mb-4 ${
                  answers[currentQuestionIndex]?.isCorrect 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="text-center mb-2">
                    <span className="text-2xl">
                      {answers[currentQuestionIndex]?.isCorrect ? '✅' : '❌'}
                    </span>
                  </div>
                  <p className={`text-center font-medium ${
                    answers[currentQuestionIndex]?.isCorrect 
                      ? 'text-green-700' 
                      : 'text-red-700'
                  }`}>
                    {answers[currentQuestionIndex]?.isCorrect ? '정답입니다!' : '틀렸습니다'}
                  </p>
                  
                  {quizSet?.show_correct_answer && !answers[currentQuestionIndex]?.isCorrect && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-600">정답:</p>
                      <p className="text-sm text-gray-900 font-medium">
                        {currentQuestion.question_type === 'short_answer' 
                          ? currentQuestion.quiz_answers?.[0]?.answer_text
                          : currentQuestion.quiz_options.find(opt => opt.is_correct)?.option_text}
                      </p>
                    </div>
                  )}
                  
                  {currentQuestion.explanation && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-600">해설:</p>
                      <p className="text-sm text-gray-700">{currentQuestion.explanation}</p>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={nextQuestion}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {currentQuestionIndex < questions.length - 1 ? '다음 문제' : '결과 보기'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 결과 화면
  if (gameState === 'finished') {
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0)
    const earnedPoints = Object.values(answers).reduce((sum, ans) => sum + ans.pointsEarned, 0)
    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    const passed = percentage >= (quizSet?.pass_score || 70)
    const correctCount = Object.values(answers).filter(ans => ans.isCorrect).length
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center">
        <Head>
          <title>Results - {quizSet?.title}</title>
        </Head>
        
        <div className="max-w-lg mx-auto px-4 py-8 w-full">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">
                {passed ? '🎆' : '💪'}
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {passed ? 'Great Job!' : 'Keep Trying!'}
              </h1>
              <p className="text-gray-400 text-sm">
                {passed ? 'You passed the quiz!' : 'Try again to improve'}
              </p>
            </div>
            
            <div className={`text-center p-6 rounded-xl mb-6 ${passed ? 'bg-green-900/20 border border-green-500/50' : 'bg-red-900/20 border border-red-500/50'}`}>
              <div className={`text-5xl font-bold mb-2 ${passed ? 'text-green-400' : 'text-red-400'}`}>
                {percentage}%
              </div>
              <p className="text-gray-400">
                {earnedPoints} / {totalPoints} points
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                <div className="text-2xl font-bold text-green-400">{correctCount}</div>
                <div className="text-xs text-gray-400">Correct</div>
              </div>
              <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                <div className="text-2xl font-bold text-red-400">{questions.length - correctCount}</div>
                <div className="text-xs text-gray-400">Wrong</div>
              </div>
            </div>
            
            <div className="text-center p-3 bg-gray-900/50 rounded-xl border border-gray-700 mb-6">
              <div className="text-sm text-gray-400">Time</div>
              <div className="text-xl font-mono text-white">
                {quizSet?.time_limit && timeLeft !== null ? 
                  formatTime((Math.floor(quizSet.time_limit / totalQuestionCount) * selectedQuestionCount) - timeLeft) : '--:--'}
              </div>
            </div>
            
            {quizSet?.allow_review && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Question Results</h2>
                <div className="space-y-2">
                  {questions.map((question, index) => {
                    const answer = answers[index]
                    return (
                      <div 
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          answer?.isCorrect ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="mr-2 text-sm">
                            {answer?.isCorrect ? '✅' : '❌'}
                          </span>
                          <span className="text-sm text-gray-300">
                            Q{index + 1}
                          </span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {answer?.pointsEarned || 0}/{question.points || 1}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={restartQuiz}
                className="w-full bg-purple-600 text-white py-4 rounded-xl hover:bg-purple-700 transition-colors font-medium"
              >
                🔄 Try Again
              </button>
              <button
                onClick={() => router.push('/quiz-list')}
                className="w-full bg-gray-700 text-gray-300 py-4 rounded-xl hover:bg-gray-600 transition-colors"
              >
                Back to List
              </button>
            </div>
            
            <div className="mt-4 text-center text-xs text-gray-500">
              <p>🎲 New random questions each attempt</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
