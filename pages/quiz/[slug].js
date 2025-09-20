import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Head from 'next/head'

export default function QuizPage() {
  const router = useRouter()
  const { slug } = router.query
  
  // 퀴즈 기본 정보
  const [quizSet, setQuizSet] = useState(null)
  const [allQuestions, setAllQuestions] = useState([])
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
  
  // 타이머
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0) {
      handleTimeUp()
    }
  }, [timeLeft, gameState])

  // 퀴즈 데이터 로드
  useEffect(() => {
    if (slug) {
      fetchQuizData()
    }
  }, [slug])

  const fetchQuizData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 퀴즈 세트 정보 가져오기
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
        .eq('slug', slug)
        .eq('is_published', true)
        .single()

      if (quizError) throw quizError
      if (!quizData) {
        setError('퀴즈를 찾을 수 없습니다.')
        return
      }

      setQuizSet(quizData)

      // 퀴즈 질문들 가져오기 - 모든 데이터를 한 번에 로드
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
        .eq('quiz_set_id', quizData.id)
        .order('order_index', { ascending: true })

      if (questionsError) throw questionsError
      
      // 각 질문의 옵션을 order_index로 정렬
      const sortedQuestions = (questionsData || []).map(question => ({
        ...question,
        quiz_options: (question.quiz_options || []).sort((a, b) => a.order_index - b.order_index)
      }))
      
      setAllQuestions(sortedQuestions)
    } catch (error) {
      console.error('Error fetching quiz data:', error)
      setError('퀴즈를 불러오는 데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 퀴즈 시작 - 모든 질문을 미리 준비
  const startQuiz = async (questionCount) => {
    setSelectedQuestionCount(questionCount)
    
    // 질문을 무작위로 섞고 선택된 개수만큼 선택
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, questionCount)
    setQuestions(selected) // 모든 질문을 미리 저장
    
    // 시간 제한 설정
    if (quizSet.time_limit) {
      setTimeLeft(quizSet.time_limit)
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

  // 답변 처리 - 즉시 처리, 서버 통신은 비동기
  const handleAnswer = useCallback((answer) => {
    if (showResult) return // 이미 답변한 경우 무시
    
    const currentQuestion = questions[currentQuestionIndex]
    let isCorrect = false
    let pointsEarned = 0
    
    // 정답 확인 (클라이언트에서 즉시 처리)
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
    
    // 서버에 비동기로 저장 (UI를 차단하지 않음)
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

  // 다음 질문으로 - 즉시 전환
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
          time_spent: quizSet.time_limit ? quizSet.time_limit - (timeLeft || 0) : null
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

  // 퀴즈 개수 옵션 생성
  const getQuestionCountOptions = () => {
    if (!allQuestions.length) return []
    
    const totalCount = allQuestions.length
    const options = []
    
    for (let i = 5; i <= totalCount; i += 5) {
      options.push(i)
    }
    
    if (totalCount % 5 !== 0) {
      options.push(totalCount)
    }
    
    if (totalCount < 5) {
      return [totalCount]
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">퀴즈를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/quiz-list')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            목록으로 돌아가기
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
          <title>{quizSet?.title || '퀴즈'} - 퀴즈 마스터</title>
        </Head>
        
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              {quizSet?.thumbnail_image && (
                <img 
                  src={quizSet.thumbnail_image} 
                  alt={quizSet.title}
                  className="w-full max-w-md h-48 object-cover rounded-lg mx-auto mb-6"
                />
              )}
              
              <h1 className="text-3xl font-bold text-gray-900 mb-3">{quizSet?.title}</h1>
              
              {quizSet?.description && (
                <p className="text-gray-600 mb-4">{quizSet.description}</p>
              )}
              
              <div className="flex justify-center gap-4 mb-6">
                {quizSet?.quiz_categories && (
                  <span 
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: quizSet.quiz_categories.color ? `${quizSet.quiz_categories.color}20` : '#f3f4f6',
                      color: quizSet.quiz_categories.color || '#6b7280'
                    }}
                  >
                    {quizSet.quiz_categories.icon} {quizSet.quiz_categories.name}
                  </span>
                )}
                
                {quizSet?.difficulty && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    quizSet.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                    quizSet.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {quizSet.difficulty === 'easy' ? '쉬움' : 
                     quizSet.difficulty === 'medium' ? '보통' : '어려움'}
                  </span>
                )}
              </div>
            </div>
            
            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">문제 수 선택</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {getQuestionCountOptions().map(count => (
                  <button
                    key={count}
                    onClick={() => startQuiz(count)}
                    className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <div className="text-2xl font-bold text-gray-900">{count}문제</div>
                    <div className="text-sm text-gray-600">
                      {quizSet?.time_limit && (
                        `제한시간: ${formatTime(Math.floor((quizSet.time_limit * count) / allQuestions.length))}`
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">퀴즈 정보</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 전체 문제: {allQuestions.length}개</li>
                  <li>• 문제 순서: 무작위</li>
                  <li>• 합격 점수: {quizSet?.pass_score || 70}점 이상</li>
                  {quizSet?.time_limit && <li>• 시간 제한: 있음</li>}
                  {quizSet?.show_correct_answer && <li>• 정답 확인: 가능</li>}
                </ul>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/quiz-list')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← 목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 퀴즈 진행 화면 - 고정 레이아웃
  if (gameState === 'playing') {
    const currentQuestion = questions[currentQuestionIndex]
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100
    const hasImage = currentQuestion?.question_image
    
    return (
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>{quizSet?.title} - 진행 중</title>
        </Head>
        
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg">
            {/* 헤더 - 고정 높이 */}
            <div className="h-24 p-6 border-b">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-sm text-gray-600">문제</span>
                  <span className="ml-2 text-lg font-bold">{currentQuestionIndex + 1} / {questions.length}</span>
                </div>
                
                {timeLeft !== null && (
                  <div className={`text-lg font-bold ${timeLeft < 30 ? 'text-red-600' : 'text-gray-900'}`}>
                    ⏰ {formatTime(timeLeft)}
                  </div>
                )}
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
            {/* 메인 콘텐츠 - 고정 높이 */}
            <div className="p-6" style={{ minHeight: '500px' }}>
              {/* 질문 영역 - 고정 높이 */}
              <div className="h-64 flex items-center justify-center mb-6 bg-gray-50 rounded-lg p-4">
                {hasImage ? (
                  <img 
                    src={currentQuestion.question_image}
                    alt="문제"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <h2 className="text-2xl font-semibold text-gray-900 text-center">
                    {currentQuestion?.question_text}
                  </h2>
                )}
              </div>
              
              {/* 질문 텍스트 (이미지가 있는 경우) */}
              {hasImage && (
                <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
                  {currentQuestion?.question_text}
                </h2>
              )}
              
              {/* 답변 영역 - 고정 위치 */}
              {!showResult ? (
                <div className="space-y-3">
                  {currentQuestion?.question_type === 'multiple_choice' && (
                    currentQuestion.quiz_options.map((option, index) => (
                      <button
                        key={option.id}
                        onClick={() => handleAnswer(option.id)}
                        className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all transform hover:scale-[1.02]"
                      >
                        <div className="flex items-center">
                          <span className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-medium mr-3">
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
                        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all transform hover:scale-[1.02]"
                      >
                        <span className="text-lg font-medium">{option.option_text}</span>
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
                        placeholder="답을 입력하세요..."
                        className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        답변 제출
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                // 결과 표시 - 고정 위치
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${answers[currentQuestionIndex]?.isCorrect ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
                    <div className="flex items-center mb-2">
                      <span className={`text-2xl mr-2`}>
                        {answers[currentQuestionIndex]?.isCorrect ? '✅' : '❌'}
                      </span>
                      <span className={`text-lg font-semibold ${answers[currentQuestionIndex]?.isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                        {answers[currentQuestionIndex]?.isCorrect ? '정답입니다!' : '틀렸습니다!'}
                      </span>
                    </div>
                    
                    {quizSet?.show_correct_answer && !answers[currentQuestionIndex]?.isCorrect && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700">정답:</p>
                        {currentQuestion.question_type === 'multiple_choice' || currentQuestion.question_type === 'true_false' ? (
                          <p className="text-sm text-gray-900 mt-1">
                            {currentQuestion.quiz_options.find(opt => opt.is_correct)?.option_text}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-900 mt-1">
                            {currentQuestion.quiz_answers?.[0]?.answer_text}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {currentQuestion.explanation && (
                      <div className="mt-4 p-3 bg-white rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-1">해설:</p>
                        <p className="text-sm text-gray-600">{currentQuestion.explanation}</p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={nextQuestion}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {currentQuestionIndex < questions.length - 1 ? '다음 문제' : '결과 보기'}
                  </button>
                </div>
              )}
            </div>
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
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>퀴즈 결과 - {quizSet?.title}</title>
        </Head>
        
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">
                {passed ? '🎉' : '😔'}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {passed ? '축하합니다!' : '아쉽네요!'}
              </h1>
              <p className="text-gray-600">
                {passed ? '퀴즈를 통과했습니다!' : '다시 도전해보세요!'}
              </p>
            </div>
            
            <div className={`text-center p-6 rounded-lg mb-6 ${passed ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-5xl font-bold mb-2" style={{ color: passed ? '#10b981' : '#ef4444' }}>
                {percentage}%
              </div>
              <p className="text-gray-700">
                {earnedPoints} / {totalPoints} 점
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{correctCount}</div>
                <div className="text-sm text-gray-600">정답</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{questions.length - correctCount}</div>
                <div className="text-sm text-gray-600">오답</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{questions.length}</div>
                <div className="text-sm text-gray-600">전체 문제</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {quizSet?.time_limit && timeLeft !== null ? formatTime(quizSet.time_limit - timeLeft) : '-'}
                </div>
                <div className="text-sm text-gray-600">소요 시간</div>
              </div>
            </div>
            
            {quizSet?.allow_review && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">문제별 결과</h2>
                <div className="space-y-2">
                  {questions.map((question, index) => {
                    const answer = answers[index]
                    return (
                      <div 
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          answer?.isCorrect ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="mr-3">
                            {answer?.isCorrect ? '✅' : '❌'}
                          </span>
                          <span className="text-sm text-gray-700">
                            문제 {index + 1}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {answer?.pointsEarned || 0} / {question.points || 1} 점
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  setGameState('setup')
                  setAnswers({})
                  setCurrentQuestionIndex(0)
                  setShowResult(false)
                  setSelectedAnswer(null)
                }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                다시 도전하기
              </button>
              <button
                onClick={() => router.push('/quiz-list')}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition-colors"
              >
                퀴즈 목록으로
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
