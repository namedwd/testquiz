import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function QuizTest() {
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
  const [isPreloading, setIsPreloading] = useState(true)
  const [loadedImages, setLoadedImages] = useState(new Set())

  // 모든 이미지 프리로드
  useEffect(() => {
    let loadedCount = 0
    const totalImages = images.length

    images.forEach((src, index) => {
      const img = new Image()
      img.onload = () => {
        loadedCount++
        setLoadedImages(prev => new Set([...prev, index]))
        
        if (loadedCount === totalImages) {
          setIsPreloading(false)
        }
      }
      img.onerror = () => {
        loadedCount++
        console.error(`Failed to load image ${index}: ${src}`)
        
        if (loadedCount === totalImages) {
          setIsPreloading(false)
        }
      }
      img.src = src
    })
  }, [])

  // 키보드 이벤트 (화살표 키)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowRight') {
        nextImage()
      } else if (e.key === 'ArrowLeft') {
        prevImage()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentIndex])

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToImage = (index) => {
    setCurrentIndex(index)
  }

  // 프리로딩 중 화면
  if (isPreloading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>이미지 로딩 중... ({loadedImages.size}/{images.length})</p>
          <div className="w-64 bg-gray-700 rounded-full h-2 mt-4">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(loadedImages.size / images.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>퀴즈 이미지 테스트 - 프리로딩</title>
      </Head>

      {/* 헤더 */}
      <div className="fixed top-0 left-0 right-0 bg-gray-800 p-4 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">퀴즈 이미지 테스트 (프리로딩 완료)</h1>
          <span className="text-lg">{currentIndex + 1} / {images.length}</span>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="pt-20 pb-24 px-4">
        <div className="max-w-4xl mx-auto">
          {/* 이미지 영역 - 고정 높이 */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="h-[500px] flex items-center justify-center">
              <img 
                src={images[currentIndex]}
                alt={`이미지 ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                style={{ display: 'block' }}
              />
            </div>
          </div>

          {/* 컨트롤 버튼 */}
          <div className="flex gap-4 justify-center mb-4">
            <button
              onClick={prevImage}
              className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              ← 이전
            </button>
            <button
              onClick={nextImage}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              다음 →
            </button>
          </div>

          {/* 썸네일 네비게이션 */}
          <div className="grid grid-cols-7 gap-2">
            {images.map((src, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`aspect-square rounded overflow-hidden border-2 transition-all ${
                  index === currentIndex 
                    ? 'border-blue-500 scale-105' 
                    : 'border-gray-600 hover:border-gray-400'
                }`}
              >
                <img 
                  src={src}
                  alt={`썸네일 ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400">
          <p>화살표 키(←→)로 이동 가능 | 모든 이미지 프리로드 완료</p>
          <p className="mt-1">이미지 전환 시 네트워크 요청 없음</p>
        </div>
      </div>
    </div>
  )
}
