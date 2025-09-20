import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

export default function QuizTestNoPreload() {
  // 이미지 URL 배열 (하드코딩)
  const images = [
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758317465391-dtnzqt.blob',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758314992754-lrrpvt.webp',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758316319327-qgu7we.webp',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758317150566-2syo51.blob',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758315890926-8yhww7.jpg',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758315899293-3gx1k9.webp',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758317159944-86wqrf.blob',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758316305321-hvby9d.png',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758314065304-58u3k5.png',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758317459325-dt2o8e.blob',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758317451893-hvvpau.blob',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758316311618-jdhlso.png',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758313742050-b0w8s7.png',
    'https://kr.object.ncloudstorage.com/quizm/quiz-questions/1758317140478-vkij05.blob'
  ]

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const imgRef = useRef(null)
  const startTimeRef = useRef(null)
  const [loadTime, setLoadTime] = useState(null)

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isLoading) return // 로딩 중에는 키 입력 무시
      
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        nextImage()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevImage()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentIndex, isLoading])

  // 이미지 변경 시 로딩 처리
  useEffect(() => {
    loadImage(currentIndex)
  }, [currentIndex])

  const loadImage = (index) => {
    setIsLoading(true)
    setLoadError(false)
    startTimeRef.current = performance.now()
    
    // 새 이미지 객체 생성하여 로드
    const img = new Image()
    
    img.onload = () => {
      const endTime = performance.now()
      const duration = Math.round(endTime - startTimeRef.current)
      setLoadTime(duration)
      
      // 실제 img 태그의 src 변경
      if (imgRef.current) {
        imgRef.current.src = images[index]
      }
      
      setIsLoading(false)
    }
    
    img.onerror = () => {
      setLoadError(true)
      setIsLoading(false)
    }
    
    // 로드 시작
    img.src = images[index]
  }

  const nextImage = () => {
    if (isLoading) return
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    if (isLoading) return
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToImage = (index) => {
    if (isLoading || index === currentIndex) return
    setCurrentIndex(index)
  }

  // 강제 리로드 (캐시 무시)
  const forceReload = () => {
    const timestamp = new Date().getTime()
    const img = new Image()
    
    setIsLoading(true)
    setLoadError(false)
    startTimeRef.current = performance.now()
    
    img.onload = () => {
      const endTime = performance.now()
      const duration = Math.round(endTime - startTimeRef.current)
      setLoadTime(duration)
      
      if (imgRef.current) {
        imgRef.current.src = `${images[currentIndex]}?t=${timestamp}`
      }
      
      setIsLoading(false)
    }
    
    img.onerror = () => {
      setLoadError(true)
      setIsLoading(false)
    }
    
    img.src = `${images[currentIndex]}?t=${timestamp}`
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>퀴즈 이미지 테스트 - 즉시 로드</title>
      </Head>

      {/* 헤더 */}
      <div className="fixed top-0 left-0 right-0 bg-gray-800 p-4 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">퀴즈 이미지 테스트 (프리로딩 없음)</h1>
              <p className="text-sm text-gray-400 mt-1">각 이미지를 클릭 시점에 로드</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{currentIndex + 1} / {images.length}</div>
              {loadTime !== null && (
                <div className="text-sm text-green-400">로드 시간: {loadTime}ms</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="pt-24 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* 이미지 영역 - 고정 높이 */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="h-[500px] flex items-center justify-center relative">
              {/* 로딩 인디케이터 */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90 z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">이미지 로딩 중...</p>
                  </div>
                </div>
              )}
              
              {/* 에러 표시 */}
              {loadError && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-red-400 mb-4">이미지 로드 실패</p>
                    <button
                      onClick={() => loadImage(currentIndex)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded"
                    >
                      다시 시도
                    </button>
                  </div>
                </div>
              )}
              
              {/* 실제 이미지 */}
              <img 
                ref={imgRef}
                alt={`이미지 ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                style={{ 
                  display: isLoading || loadError ? 'none' : 'block',
                  opacity: isLoading ? 0 : 1,
                  transition: 'opacity 0.2s'
                }}
              />
            </div>
          </div>

          {/* 컨트롤 버튼 */}
          <div className="flex gap-4 justify-center mb-6">
            <button
              onClick={prevImage}
              disabled={isLoading}
              className={`px-8 py-3 rounded-lg transition-all ${
                isLoading 
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              ← 이전
            </button>
            
            <button
              onClick={nextImage}
              disabled={isLoading}
              className={`px-8 py-3 rounded-lg transition-all font-bold ${
                isLoading 
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              다음 →
            </button>
            
            <button
              onClick={forceReload}
              disabled={isLoading}
              className={`px-8 py-3 rounded-lg transition-all ${
                isLoading 
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              캐시 무시 리로드
            </button>
          </div>

          {/* 빠른 네비게이션 */}
          <div className="flex justify-center gap-2 flex-wrap">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                disabled={isLoading}
                className={`w-10 h-10 rounded transition-all ${
                  index === currentIndex 
                    ? 'bg-blue-600 scale-110' 
                    : isLoading
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {/* 통계 정보 */}
          <div className="mt-8 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-bold mb-2">로드 정보</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">현재 이미지:</span>
                <p className="text-white font-mono text-xs truncate">{images[currentIndex].split('/').pop()}</p>
              </div>
              <div>
                <span className="text-gray-400">로드 시간:</span>
                <p className={`font-bold ${
                  loadTime < 100 ? 'text-green-400' : 
                  loadTime < 300 ? 'text-yellow-400' : 
                  'text-red-400'
                }`}>
                  {loadTime ? `${loadTime}ms` : '-'}
                </p>
              </div>
              <div>
                <span className="text-gray-400">상태:</span>
                <p className="text-white">
                  {isLoading ? '로딩 중...' : loadError ? '에러' : '완료'}
                </p>
              </div>
              <div>
                <span className="text-gray-400">캐시 상태:</span>
                <p className="text-white">
                  {loadTime && loadTime < 50 ? '캐시됨' : '네트워크'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-400">
          <p>화살표 키(←→) 또는 스페이스바로 이동 | 프리로딩 없음 - 실시간 네트워크 로드</p>
          <p className="mt-1 text-yellow-400">
            첫 로드는 느림 (네트워크) | 재방문 시 빠름 (브라우저 캐시)
          </p>
        </div>
      </div>
    </div>
  )
}
