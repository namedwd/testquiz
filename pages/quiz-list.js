import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function QuizList() {
  const [quizzes, setQuizzes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchCategories()
    fetchQuizzes()
  }, [selectedCategory, selectedDifficulty])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('quiz_categories')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchQuizzes = async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('quiz_sets')
        .select(`
          *,
          quiz_categories (
            name,
            color,
            icon
          )
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      // 카테고리 필터
      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory)
      }

      // 난이도 필터
      if (selectedDifficulty !== 'all') {
        query = query.eq('difficulty', selectedDifficulty)
      }

      const { data, error } = await query

      if (error) throw error
      setQuizzes(data || [])
    } catch (error) {
      console.error('Error fetching quizzes:', error)
      setError('퀴즈를 불러오는 데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 검색 필터링
  const filteredQuizzes = quizzes.filter(quiz => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      quiz.title.toLowerCase().includes(query) ||
      (quiz.description && quiz.description.toLowerCase().includes(query))
    )
  })

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDifficultyText = (difficulty) => {
    switch (difficulty) {
      case 'easy':
        return '쉬움'
      case 'medium':
        return '보통'
      case 'hard':
        return '어려움'
      default:
        return difficulty
    }
  }

  const formatTime = (seconds) => {
    if (!seconds) return '제한 없음'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}분`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`
  }

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
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => fetchQuizzes()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">퀴즈 목록</h1>
          <p className="text-gray-600">다양한 주제의 퀴즈를 풀어보세요!</p>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 검색 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                검색
              </label>
              <input
                type="text"
                placeholder="퀴즈 제목 또는 설명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 카테고리 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 난이도 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                난이도
              </label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="easy">쉬움</option>
                <option value="medium">보통</option>
                <option value="hard">어려움</option>
              </select>
            </div>
          </div>
        </div>

        {/* 퀴즈 목록 */}
        {filteredQuizzes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">
              {searchQuery || selectedCategory !== 'all' || selectedDifficulty !== 'all'
                ? '검색 결과가 없습니다.'
                : '아직 등록된 퀴즈가 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <Link href={`/quiz/${quiz.slug}`}>
                  <div className="p-6">
                    {/* 썸네일 이미지 */}
                    {quiz.thumbnail_image && (
                      <div className="mb-4 h-40 bg-gray-100 rounded-md overflow-hidden">
                        <img
                          src={quiz.thumbnail_image}
                          alt={quiz.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* 카테고리 및 난이도 배지 */}
                    <div className="flex items-center gap-2 mb-3">
                      {quiz.quiz_categories && (
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: quiz.quiz_categories.color ? `${quiz.quiz_categories.color}20` : '#f3f4f6',
                            color: quiz.quiz_categories.color || '#6b7280'
                          }}
                        >
                          {quiz.quiz_categories.icon} {quiz.quiz_categories.name}
                        </span>
                      )}
                      {quiz.difficulty && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(quiz.difficulty)}`}>
                          {getDifficultyText(quiz.difficulty)}
                        </span>
                      )}
                    </div>

                    {/* 제목 */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {quiz.title}
                    </h3>

                    {/* 설명 */}
                    {quiz.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {quiz.description}
                      </p>
                    )}

                    {/* 퀴즈 정보 */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-3">
                        <span>문제 {quiz.question_count}개</span>
                        {quiz.time_limit && (
                          <>
                            <span>•</span>
                            <span>{formatTime(quiz.time_limit)}</span>
                          </>
                        )}
                      </div>
                      {quiz.attempt_count > 0 && (
                        <span>{quiz.attempt_count}회 시도</span>
                      )}
                    </div>

                    {/* 합격 점수 */}
                    {quiz.pass_score && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                          합격 점수: {quiz.pass_score}점 이상
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
