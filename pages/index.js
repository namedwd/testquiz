import Link from 'next/link';
import Head from 'next/head';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Head>
        <title>퀴즈 웹사이트</title>
        <meta name="description" content="다양한 주제의 퀴즈를 풀어보세요" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 섹션 */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              🎯 퀴즈 마스터
            </h1>
            <p className="text-xl text-gray-600">
              지식을 테스트하고 새로운 것을 배워보세요!
            </p>
          </div>

          {/* 메인 카드 */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-8 md:p-12">
              <div className="space-y-6">
                {/* 퀴즈 목록 링크 */}
                <Link href="/quiz-list">
                  <div className="group bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 cursor-pointer transform transition-all duration-200 hover:scale-105 hover:shadow-2xl">
                    <div className="flex items-center justify-between">
                      <div className="text-white">
                        <h2 className="text-2xl font-semibold mb-2">퀴즈 목록 보기</h2>
                        <p className="text-blue-100">
                          다양한 카테고리의 퀴즈를 탐색하고 도전해보세요
                        </p>
                      </div>
                      <div className="text-white text-4xl group-hover:translate-x-2 transition-transform">
                        →
                      </div>
                    </div>
                  </div>
                </Link>

                {/* 기능 소개 */}
                <div className="grid md:grid-cols-3 gap-4 mt-8">
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <div className="text-3xl mb-3">📚</div>
                    <h3 className="font-semibold text-gray-900 mb-1">다양한 카테고리</h3>
                    <p className="text-sm text-gray-600">
                      여러 주제의 퀴즈를 제공합니다
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <div className="text-3xl mb-3">⏱️</div>
                    <h3 className="font-semibold text-gray-900 mb-1">시간 제한 도전</h3>
                    <p className="text-sm text-gray-600">
                      제한 시간 내에 문제를 풀어보세요
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <div className="text-3xl mb-3">🏆</div>
                    <h3 className="font-semibold text-gray-900 mb-1">난이도 선택</h3>
                    <p className="text-sm text-gray-600">
                      쉬움부터 어려움까지 선택 가능
                    </p>
                  </div>
                </div>

                {/* 통계 섹션 */}
                <div className="border-t pt-6 mt-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">9+</div>
                      <div className="text-sm text-gray-600">카테고리</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">50+</div>
                      <div className="text-sm text-gray-600">퀴즈 세트</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">500+</div>
                      <div className="text-sm text-gray-600">문제</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">1000+</div>
                      <div className="text-sm text-gray-600">참여자</div>
                    </div>
                  </div>
                </div>

                {/* CTA 버튼 */}
                <div className="text-center pt-6">
                  <Link href="/quiz-list">
                    <button className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200">
                      지금 시작하기
                      <span className="ml-2">🚀</span>
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 하단 안내 */}
          <div className="mt-12 text-center text-gray-600">
            <p className="text-sm">
              매주 새로운 퀴즈가 추가됩니다 • 무료로 이용 가능
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
