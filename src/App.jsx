import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { LayoutDashboard, BarChart3, CreditCard, Wallet, Plus, Trash2, Edit2, Download, Clock, DollarSign } from 'lucide-react';

/**
 * 📊 모금 공구 현황 관리 시스템 (v4.0 PayPal 기능 강화)
 * - [추가] PayPal 탭: 메모 입력란 추가, 달러($) 입력 시 원화 자동 환산
 * - [수정] 투표 집계: 계좌(입금자명) vs PayPal(메모) 기준 분리
 * - [수정] 엑셀: PayPal 시트에 달러/원화/메모 컬럼 분리 저장
 */

// ------------------------------------------------------------------
// [🔥 중요] 파이어베이스 설정값 입력
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAAsSQu0e-XiMUe4SwgTkGUCI9iCBw3c_s",
  authDomain: "my-fund-app-d8dd2.firebaseapp.com",
  projectId: "my-fund-app-d8dd2",
  storageBucket: "my-fund-app-d8dd2.firebasestorage.app",
  messagingSenderId: "213521376392",
  appId: "1:213521376392:web:b3b1e838073cd61db86b3d"
};

// [💰 환율 설정] 1달러당 원화 금액 (필요시 수정하세요)
const EXCHANGE_RATE = 1450; 
const GOAL_AMOUNT = 25800000; // 목표 모금액 수정

// Firebase 초기화
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase 설정이 완료되지 않았습니다.");
}

const WEEKLY_CONFIG = {
  1: {
    label: "1주차 (2/13~19)",
    question: "Q. 온유와 닮은 동물은?",
    start: "2026-02-13", end: "2026-02-19",
    options: [
      { name: "토끼", keywords: ["토끼", "토","1"] },
      { name: "고양이", keywords: ["고양이", "냥", "냐옹", "2"] },
      { name: "강아지", keywords: ["강아지", "멍", "3"] },
      { name: "족제비", keywords: ["족제비", "4"] },
      { name: "오목눈이", keywords: ["오목눈이", "오목"] }
    ]
  },
  2: {
    label: "2주차 (2/20~26)",
    question: "Q. 온유는 온둡 vs 냉둡?!",
    start: "2026-02-20", end: "2026-02-26",
    options: [
      { name: "온둡", keywords: ["온", "1"] },
      { name: "냉둡", keywords: ["냉", "2"] }
    ]
  },
  3: {
    label: "3주차 (2/27~3/5)",
    question: "Q. 이번 앨범티징 최애 컨포는?",
    start: "2026-02-27", end: "2026-03-05",
    options: [
      { name: "#🖤", keywords: ["검", "1"] },
      { name: "#💙", keywords: ["파", "청", "2"] },
      { name: "#❤️", keywords: ["빨", "3"] },
      { name: "#🩷", keywords: ["핑", "분홍", "4"] },
      { name: "#🤎", keywords: ["갈", "브라운", "5"] },
      { name: "#💚", keywords: ["초", "그린", "green", "6"] }
    ]
  },
  4: {
    label: "4주차 (3/6~12)",
    question: "Q. 이번 앨범 최애 수록곡은?",
    start: "2026-03-06", end: "2026-03-12",
    options: [
      { name: "Dot dot dot(...)", keywords: ["Dot", "dot", "닷", "1"] },
      { name: "Flex on me", keywords: ["플", "Flex", "flex", "2"] },
      { name: "Lie", keywords: ["Lie", "lie", "라이", "거짓말", "3"] },
      { name: "X, Oh Why?", keywords: ["X", "x", "와이", "엑", "4"] }
    ]
  },
  6: {
    label: "", // 레이블 제거
    question: "Q. 이번 앨범 최애 엔딩요정/무대는?",
    start: "2026-03-13", end: "2026-12-31", // 현재 입금건들이 이쪽으로 배정되도록 설정
    options: [
      { name: "1. 엠카", keywords: ["엠카", "엠", "m", "1"] },
      { name: "2. 뮤뱅", keywords: ["뮤뱅", "뮤", "2"] },
      { name: "3. 음중", keywords: ["음중", "음", "3"] },
      { name: "4. 인가", keywords: ["인가", "인", "4"] }
    ]
  },
  5: {
    label: "", 
    question: "🩷 목표 모금액 달성률 💚",
    start: "2099-01-01", end: "2099-12-31", // 자동 맵핑되지 않도록 설정 (순수 누적 집계용)
    options: [] 
  }
};

const formatNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const genTimeOpts = (max) => Array.from({ length: max }, (_, i) => i.toString().padStart(2, '0'));

export default function FundraisingApp() {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [currentWeek, setCurrentWeek] = useState(1);
  const [transactions, setTransactions] = useState([]);
  const [editingId, setEditingId] = useState(null); 

  // 입력 폼 상태
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [hour, setHour] = useState('00');
  const [minute, setMinute] = useState('00');
  const [second, setSecond] = useState('00');
  const [inputName, setInputName] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [inputMemo, setInputMemo] = useState(''); 

  const hours = genTimeOpts(24);
  const minutes = genTimeOpts(60);
  const seconds = genTimeOpts(60);

  useEffect(() => {
    document.title = "TOUGH LOVE 모금현황";
  }, []);

  // [DB] 데이터 불러오기
  useEffect(() => {
    if (!db) return;
    const q = collection(db, "transactions");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      // 오름차순 정렬
      txData.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
      setTransactions(txData);
    });
    return () => unsubscribe();
  }, []);

  const getWeekByDate = (dateStr) => {
    for (const [week, config] of Object.entries(WEEKLY_CONFIG)) {
      if (dateStr >= config.start && dateStr <= config.end) return parseInt(week);
    }
    return 0;
  };

  const getOptionByName = (week, text) => {
    if (!WEEKLY_CONFIG[week]) return "범위외";
    if (!WEEKLY_CONFIG[week].options || WEEKLY_CONFIG[week].options.length === 0) return "목표달성집계";
    for (const opt of WEEKLY_CONFIG[week].options) {
      if (opt.keywords.some(k => text.includes(k))) return opt.name;
    }
    return "무효표";
  };

  // [DB] 데이터 저장
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputName || !inputAmount || !inputDate) return;

    const rawAmount = parseFloat(inputAmount); 
    const week = getWeekByDate(inputDate);
    
    // 탭에 따라 결제 정보 처리
    const isPayPal = activeTab === 'paypal';
    const paymentType = isPayPal ? 'PayPal' : '계좌이체';
    const finalTime = `${hour}:${minute}:${second}`;

    // 1. 투표 집계 대상 텍스트 결정
    const targetTextForOption = isPayPal ? inputMemo : inputName;
    let option = week > 0 ? getOptionByName(week, targetTextForOption) : "범위외";

    // 2. 금액 계산
    const convertedAmount = isPayPal ? Math.round(rawAmount * EXCHANGE_RATE) : rawAmount;

    const txData = {
      type: paymentType,
      date: inputDate,
      time: finalTime,
      name: inputName,
      memo: isPayPal ? inputMemo : "", 
      originalAmount: rawAmount,       
      amount: convertedAmount,         
      week: week,
      option: option
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "transactions", editingId), txData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "transactions"), txData);
      }
      // 초기화
      setInputName(''); 
      setInputAmount('');
      setInputMemo('');
    } catch (err) { alert("저장 실패!"); }
  };

  const handleDelete = async (id) => {
    if (!db) return;
    if(window.confirm("삭제하시겠습니까?")) await deleteDoc(doc(db, "transactions", id));
  };

  const handleEditClick = (t) => {
    setEditingId(t.id); setInputDate(t.date);
    const [h, m, s] = t.time.split(':');
    setHour(h || '00'); setMinute(m || '00'); setSecond(s || '00');
    setInputName(t.name); 
    
    setInputAmount(t.originalAmount ? t.originalAmount.toString() : t.amount.toString());
    setInputMemo(t.memo || "");

    setActiveTab(t.type === 'PayPal' ? 'paypal' : 'bank');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setInputName('');
    setInputAmount('');
    setInputMemo('');
  };

  // 통계 계산
  const stats = useMemo(() => {
    const targetDateTime = "2026-03-09T13:00:00";
    
    // 누적 금액을 3월 9일 13시 이후 데이터로 필터링
    const cumulativeTxs = transactions.filter(t => {
      const txDateTime = t.date + "T" + t.time;
      if (currentWeek === 5) {
          // 5주차는 3월 9일 13시 이후의 모든 데이터를 집계
          return txDateTime >= targetDateTime;
      }
      // 6주차(최애무대)에서도 하단 누적액이 정상 표기되도록 조건 적용
      return t.week > 0 && t.week <= currentWeek && txDateTime >= targetDateTime;
    });
    
    const cumulativeTotal = cumulativeTxs.reduce((sum, t) => sum + t.amount, 0);
    const goalPercent = Math.min(100, (cumulativeTotal / GOAL_AMOUNT) * 100).toFixed(1);

    // 5주차는 목표달성률 전용 원그래프 출력
    if (currentWeek === 5) {
      const achieved = cumulativeTotal;
      const remaining = Math.max(0, GOAL_AMOUNT - achieved);
      const achievedPct = GOAL_AMOUNT > 0 ? ((achieved / GOAL_AMOUNT) * 100).toFixed(1) : 0;
      const remainingPct = GOAL_AMOUNT > 0 ? ((remaining / GOAL_AMOUNT) * 100).toFixed(1) : 0;

      const chartData = [
        { name: "달성액", value: achieved, percent: achievedPct, color: "#D5A2A1" },
        { name: "남은 금액", value: remaining, percent: remainingPct, color: "#E5E7EB" } 
      ];

      return { weekTotal: achieved, validTotal: GOAL_AMOUNT, invalidSum: 0, chartData, cumulativeTotal, goalPercent };
    }

    // 기존 1~4주차 & 신규 6주차 투표 결과 집계 로직
    const weekTxs = transactions.filter(t => t.week === currentWeek);
    const optionSums = {};
    WEEKLY_CONFIG[currentWeek].options.forEach(opt => optionSums[opt.name] = 0);
    let invalidSum = 0; let weekTotal = 0;

    weekTxs.forEach(t => {
      weekTotal += t.amount;
      if (t.option === "무효표") invalidSum += t.amount;
      else if (optionSums[t.option] !== undefined) optionSums[t.option] += t.amount;
      else invalidSum += t.amount; 
    });

    const validTotal = weekTotal - invalidSum;
    const chartData = WEEKLY_CONFIG[currentWeek].options.map((opt, idx) => {
      const amt = optionSums[opt.name];
      const pct = validTotal > 0 ? ((amt / validTotal) * 100).toFixed(1) : 0;
      const colors = ["#86A5DC", "#D5A2A1", "#A6C1EE", "#E8C5C4", "#B0C4DE", "#F4C2C2"];
      return { name: opt.name, value: amt, percent: pct, color: colors[idx % colors.length] };
    });

    return { weekTotal, validTotal, invalidSum, chartData, cumulativeTotal, goalPercent };
  }, [transactions, currentWeek]);

  // 엑셀 다운로드
  const downloadExcel = () => {
    if (typeof window.XLSX === 'undefined') {
      alert("엑셀 라이브러리 로드 실패. 페이지를 새로고침 해주세요.");
      return;
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    const bankData = transactions
      .filter(t => t.type === '계좌이체')
      .map(t => ({
        "날짜": t.date,
        "시간": t.time,
        "입금자명": t.name,
        "금액(원)": t.amount,
        "주차": t.week > 0 ? (t.week === 6 ? `최애무대` : `${t.week}주차`) : "범위외",
        "분류": t.option
      }));
    const wsBank = XLSX.utils.json_to_sheet(bankData);
    XLSX.utils.book_append_sheet(wb, wsBank, "원화 입금(계좌)");

    const paypalData = transactions
      .filter(t => t.type === 'PayPal')
      .map(t => ({
        "날짜": t.date,
        "시간": t.time,
        "입금자명": t.name,
        "메모(투표)": t.memo,
        "입금액($)": t.originalAmount,
        "환산액(원)": t.amount,
        "적용환율": EXCHANGE_RATE,
        "주차": t.week > 0 ? (t.week === 6 ? `최애무대` : `${t.week}주차`) : "범위외",
        "분류": t.option
      }));
    const wsPaypal = XLSX.utils.json_to_sheet(paypalData);
    XLSX.utils.book_append_sheet(wb, wsPaypal, "PayPal");

    XLSX.writeFile(wb, `온유_모금정산_통합본_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const dDayText = useMemo(() => {
    const config = WEEKLY_CONFIG[currentWeek];
    const endDate = new Date(config.end + "T23:59:59");
    const diff = endDate - new Date();
    if (diff < 0) return "투표 마감";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days === 0 ? "D-Day" : `D-${days}`;
  }, [currentWeek]);

  const isGraphOnly = activeTab === 'graph';

  const renderPieChart = () => {
    let acc = 0;
    return stats.chartData.map((item, idx) => {
      const pct = parseFloat(item.percent);
      if (pct === 0) return null;
      const startAngle = acc * 2 * Math.PI;
      const endAngle = (acc + pct / 100) * 2 * Math.PI;
      const x1 = Math.cos(startAngle); const y1 = Math.sin(startAngle);
      const x2 = Math.cos(endAngle); const y2 = Math.sin(endAngle);
      const largeArc = pct > 50 ? 1 : 0;
      const pathData = `M ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} L 0 0`;
      const midAngle = startAngle + (endAngle - startAngle) / 2;
      const labelX = Math.cos(midAngle) * 0.72; const labelY = Math.sin(midAngle) * 0.72;
      acc += pct / 100;

      // 5주차일 때는 차트 내 텍스트 미출력
      const showLabel = pct > 5 && currentWeek !== 5;

      return (
        <g key={idx}>
          <path d={pathData} fill={item.color} stroke="white" strokeWidth="0.02" />
          {showLabel && (
            <text 
              x={labelX} y={labelY} 
              fill="#ffffff" 
              fontSize="0.09" 
              fontWeight="bold" 
              textAnchor="middle" 
              dominantBaseline="middle" 
              transform={`rotate(90 ${labelX} ${labelY})`} 
              style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.5)", pointerEvents: 'none' }}
            >
              {item.name}
            </text>
          )}
        </g>
      );
    });
  };

  const currentList = useMemo(() => {
    if (activeTab === 'dashboard' || activeTab === 'graph') return [];
    const type = activeTab === 'paypal' ? 'PayPal' : '계좌이체';
    return transactions.filter(t => t.type === type);
  }, [activeTab, transactions]);

  // 표시할 탭 배열 (6주차: 새 앙케이트, 5주차: 달성률)
  const TABS_CONFIG = [
    { id: 1, label: '1주차' },
    { id: 2, label: '2주차' },
    { id: 3, label: '3주차' },
    { id: 4, label: '4주차' },
    { id: 6, label: '최애무대' },
    { id: 5, label: '목표달성' }
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-0 sm:py-10 font-sans text-gray-800">
      <style>{`
        @font-face { font-family: 'GmarketSans'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff') format('woff'); font-weight: 500; }
        @font-face { font-family: 'GmarketSans'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff') format('woff'); font-weight: 700; }
        body { font-family: 'GmarketSans', sans-serif !important; }
      `}</style>

      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[850px] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-gray-100">
        
        {/* 상단 탭 */}
        <div className="px-6 pt-6 pb-2 bg-white sticky top-0 z-30 border-b border-gray-100">
          <h1 className="text-center text-lg font-black text-[#86A5DC] tracking-widest mb-4 uppercase">TOUGH LOVE 모금현황</h1>
          <div className="flex bg-gray-100 p-1 rounded-2xl mb-2">
            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}><LayoutDashboard size={14} /> 현황판</button>
            <button onClick={() => setActiveTab('graph')} className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${activeTab === 'graph' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}><BarChart3 size={14} /> 그래프</button>
            <button onClick={() => setActiveTab('bank')} className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${activeTab === 'bank' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}><CreditCard size={14} /> 원화</button>
            <button onClick={() => setActiveTab('paypal')} className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${activeTab === 'paypal' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}><Wallet size={14} /> PayPal</button>
          </div>
        </div>

        {/* --- 현황판 / 그래프 --- */}
        {(activeTab === 'dashboard' || activeTab === 'graph') && (
          <div className="flex-1 px-6 pb-10 overflow-y-auto">
            <div className="flex justify-between items-center my-4 overflow-x-auto">
              {TABS_CONFIG.map(tab => (
                <button key={tab.id} onClick={() => setCurrentWeek(tab.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap mr-2 transition-colors ${currentWeek === tab.id ? 'bg-[#D5A2A1] text-white' : 'bg-gray-100 text-gray-400'}`}>{tab.label}</button>
              ))}
            </div>

            <div className="bg-white border-2 border-[#86A5DC]/20 rounded-3xl p-5 relative overflow-hidden shadow-sm mb-6">
              <div className="text-center mb-3">
                {/* 레이블 숨김 처리 */}
                {WEEKLY_CONFIG[currentWeek].label && (
                  <span className="inline-block px-2 py-0.5 rounded bg-[#86A5DC]/10 text-[#86A5DC] text-[10px] font-bold mb-1">{WEEKLY_CONFIG[currentWeek].label}</span>
                )}
                <h2 className="text-base font-bold text-gray-900">{WEEKLY_CONFIG[currentWeek].question}</h2>
              </div>

              <div className="flex items-center justify-center mb-6">
                {stats.validTotal > 0 ? (
                  <div className="relative w-48 h-48">
                    <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">{renderPieChart()}</svg>
                    {/* 5주차일 경우 가운데 구멍(도넛차트 속성)을 막아 꽉 찬 그래프로 표시 */}
                    {currentWeek !== 5 && (
                      <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner z-10">
                        <span className="text-[9px] text-gray-400 font-bold">{isGraphOnly ? "투표 마감까지" : "이번주 모금"}</span>
                        {isGraphOnly ? <span className="text-sm font-black text-[#D5A2A1]">{dDayText}</span> : <span className="text-sm font-black text-gray-800">{formatNum(stats.weekTotal)}</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-full bg-gray-100 flex flex-col items-center justify-center text-gray-400 text-xs"><p>데이터 없음</p></div>
                )}
              </div>

              {/* 5주차가 아닐 때만 하단 범주 렌더링 */}
              {currentWeek !== 5 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {stats.chartData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: item.color}} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-600 truncate font-bold">{item.name}</span>
                          <span className="text-[10px] font-black text-[#86A5DC]">{item.percent}%</span>
                        </div>
                        {!isGraphOnly && <p className="text-[9px] text-gray-400 text-right">{formatNum(item.value)}원</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 5주차가 아닐 때만 하단 별표(*) 안내 텍스트 렌더링 */}
              {currentWeek !== 5 && (
                isGraphOnly ? (
                  <div className="text-right text-[9px] text-gray-400 mb-3 leading-tight opacity-80 font-medium">
                    * PayPal 투표액은 고정환율로 계산하여 반영됩니다.<br/>
                    * 성함 등 항목 분류가 불가능한 무효표는 투표 집계에서 제외됩니다.
                  </div>
                ) : (
                  <div className="text-right text-[10px] text-gray-400 mb-3">* 무효표/기타: {formatNum(stats.invalidSum)}원 (집계 제외)</div>
                )
              )}

              <div className="border-t-2 border-dashed border-gray-100 pt-2">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-[#D5A2A1]">TOTAL PROGRESS</span>
                  <span className="text-xl font-black text-[#D5A2A1]">{stats.goalPercent}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-[#D5A2A1] to-[#E8C5C4] relative" style={{ width: `${stats.goalPercent}%` }}></div>
                </div>
                {!isGraphOnly && <div className="flex justify-between mt-1 text-[9px] font-bold text-gray-400"><span>누적 {formatNum(stats.cumulativeTotal)}원</span><span>목표 2,580만원</span></div>}
              </div>
            </div>
            
          </div>
        )}

        {/* --- 탭 3 & 4: 입력 폼 (원화/페이팔) --- */}
        {(activeTab === 'bank' || activeTab === 'paypal') && (
          <div className="flex-1 px-4 pb-4 overflow-hidden flex flex-col">
            <form onSubmit={handleSubmit} className={`p-4 rounded-2xl mb-4 shrink-0 border transition-colors ${activeTab === 'paypal' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200'} ${editingId ? 'ring-2 ring-[#D5A2A1]' : ''}`}>
              <h3 className="text-xs font-bold text-gray-500 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1">{editingId ? <Edit2 size={12} /> : <Plus size={12} />}{editingId ? '내역 수정 중...' : (activeTab === 'paypal' ? 'PayPal 내역 추가' : '원화 입금 내역 추가')}</span>
                {editingId && <button type="button" onClick={() => setEditingId(null)} className="text-xs text-red-500 underline">취소</button>}
              </h3>
              <div className="flex gap-2 mb-2">
                <div className="w-28 shrink-0">
                    <label className="text-[9px] text-gray-400 block mb-1">날짜</label>
                    <input type="date" required value={inputDate} onChange={(e) => setInputDate(e.target.value)} className="w-full text-xs p-1.5 rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white h-[34px]" />
                </div>
                <div className="flex-1">
                    <label className="text-[9px] text-gray-400 block mb-1">시간 (시:분:초)</label>
                    <div className="flex gap-1">
                        <select value={hour} onChange={(e) => setHour(e.target.value)} className="flex-1 text-xs py-1.5 px-0 text-center rounded-lg border border-white bg-white h-[34px]">{hours.map(h => <option key={h} value={h}>{h}시</option>)}</select>
                        <span className="self-center text-gray-400 text-[10px]">:</span>
                        <select value={minute} onChange={(e) => setMinute(e.target.value)} className="flex-1 text-xs py-1.5 px-0 text-center rounded-lg border border-white bg-white h-[34px]">{minutes.map(m => <option key={m} value={m}>{m}분</option>)}</select>
                        <span className="self-center text-gray-400 text-[10px]">:</span>
                        <select value={second} onChange={(e) => setSecond(e.target.value)} className="flex-1 text-xs py-1.5 px-0 text-center rounded-lg border border-white bg-white h-[34px]">{seconds.map(s => <option key={s} value={s}>{s}초</option>)}</select>
                    </div>
                </div>
              </div>
              
              <div className="mb-2">
                 <label className="text-[9px] text-gray-400 block mb-1">입금자명 {activeTab === 'paypal' && "(영문명)"}</label>
                 <input type="text" required value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder={activeTab === 'paypal' ? "예: JINKI LEE" : "예: 이진기토끼"} className="w-full text-xs p-2 rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white" />
              </div>

              {activeTab === 'paypal' && (
                <div className="mb-2">
                   <label className="text-[9px] text-[#86A5DC] font-bold block mb-1">메모 (투표 키워드 입력)</label>
                   <input type="text" value={inputMemo} onChange={(e) => setInputMemo(e.target.value)} placeholder="예: Rabbit (이곳의 내용으로 투표 집계됩니다)" className="w-full text-xs p-2 rounded-lg border border-[#86A5DC] focus:outline-none bg-blue-50/50" />
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 relative">
                   {activeTab === 'paypal' && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={12} /></div>}
                   <input 
                      type="text" 
                      required 
                      value={inputAmount} 
                      onChange={(e) => setInputAmount(e.target.value)} 
                      placeholder={activeTab === 'paypal' ? "금액 (달러)" : "금액 (원)"} 
                      className={`w-full text-xs p-2 rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white ${activeTab === 'paypal' ? 'pl-7' : ''}`} 
                    />
                </div>
                <button type="submit" className={`text-white px-4 rounded-lg text-xs font-bold ${editingId ? 'bg-[#D5A2A1]' : 'bg-[#86A5DC]'}`}>{editingId ? '수정' : '추가'}</button>
              </div>
              {activeTab === 'paypal' && <p className="text-[9px] text-gray-400 mt-2 text-right">* 환율 1$ = {formatNum(EXCHANGE_RATE)}원 자동 적용</p>}
            </form>

            <div className="flex-1 overflow-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-500 font-bold sticky top-0 z-10"><tr><th className="p-3">날짜/시간</th><th className="p-3">내용</th><th className="p-3">금액</th><th className="p-3 text-center">관리</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {currentList.length > 0 ? currentList.map((t) => (
                    <tr key={t.id} className={`hover:bg-gray-50/50 ${editingId === t.id ? 'bg-[#D5A2A1]/10' : ''}`}>
                      <td className="p-3 text-gray-400"><div className="font-bold">{t.date.slice(5)}</div><div className="text-[9px]">{t.time}</div></td>
                      <td className="p-3 font-medium text-gray-700">
                        {t.name}
                        {t.type === 'PayPal' && <div className="text-[9px] text-gray-400">{t.memo}</div>}
                        <div className="text-[9px] text-[#86A5DC]">{t.option}</div>
                      </td>
                      <td className="p-3 text-gray-900">
                        {formatNum(t.amount)}
                        {t.type === 'PayPal' && <div className="text-[9px] text-gray-400">(${t.originalAmount})</div>}
                      </td>
                      <td className="p-3 text-center flex justify-center gap-2">
                        <button onClick={() => handleEditClick(t)} className="text-gray-300 hover:text-[#86A5DC]"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="4" className="p-10 text-center text-gray-300 font-bold">내역 없음</td></tr>}
                </tbody>
              </table>
            </div>

            {/* 원화 탭 하단 엑셀 다운로드 버튼 */}
            {activeTab === 'bank' && (
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={downloadExcel}
                  className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-black transition-all shadow-sm"
                >
                  <Download size={14} /> 통합 정산 엑셀(.xlsx) 저장
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}