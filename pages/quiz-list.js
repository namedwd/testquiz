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
        return 'bg-green-900/30 text-green-400 border border-green-600'
      case 'medium':
        return 'bg-yellow-900/30 text-yellow-400 border border-yellow-600'
      case 'hard':
        return 'bg-red-900/30 text-red-400 border border-red-600'
      default:
        return 'bg-gray-700 text-gray-400'
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">퀴즈를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => fetchQuizzes()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">퀴즈 목록</h1>
          <p className="text-gray-400">다양한 주제의 퀴즈를 풀어보세요!</p>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 검색 */}
            <div>
              <input
                type="text"
                placeholder="퀴즈 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 카테고리 필터 */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체 카테고리</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 난이도 필터 */}
            <div>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체 난이도</option>
                <option value="easy">쉬움</option>
                <option value="medium">보통</option>
                <option value="hard">어려움</option>
              </select>
            </div>
          </div>
        </div>

        {/* 퀴즈 목록 */}
        {filteredQuizzes.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400">
              {searchQuery || selectedCategory !== 'all' || selectedDifficulty !== 'all'
                ? '검색 결과가 없습니다.'
                : '아직 등록된 퀴즈가 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz) => (
              <Link key={quiz.id} href={`/quiz/${quiz.id}`}>
                <div className="bg-gray-800 rounded-xl hover:bg-gray-750 transition-all cursor-pointer">
                  {/* 썸네일 이미지 */}
                  {quiz.thumbnail_image && (
                    <div className="h-40 bg-gray-700 rounded-t-xl overflow-hidden">
                      <img
                        src={quiz.thumbnail_image}
                        alt={quiz.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="p-6">
                    {/* 카테고리 및 난이도 */}
                    <div className="flex items-center gap-2 mb-3">
                      {quiz.quiz_categories && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-700 text-gray-300 rounded">
                          {quiz.quiz_categories.icon} {quiz.quiz_categories.name}
                        </span>
                      )}
                      {quiz.difficulty && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getDifficultyColor(quiz.difficulty)}`}>
                          {getDifficultyText(quiz.difficulty)}
                        </span>
                      )}
                    </div>

                    {/* 제목 */}
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {quiz.title}
                    </h3>

                    {/* 설명 */}
                    {quiz.description && (
                      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
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
                        <span>{quiz.attempt_count}회</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
