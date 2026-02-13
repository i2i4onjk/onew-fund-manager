import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Calculator, Save, Download, Trash2, Plus, Table as TableIcon, LayoutDashboard, Calendar, Search, Clock, CreditCard, Wallet, BarChart3 } from 'lucide-react';

/**
 * 📊 모금 공구 현황 관리 시스템 (v2.7 레이아웃 최적화)
 * - [수정] 날짜/시간 입력 칸 높이 축소 (h-[34px]) 및 패딩 최적화
 * - 날짜 칸 너비(w-28) 유지, 시간 칸은 컴팩트하게 정렬
 * - 시/분/초 다이얼 선택 방식 유지
 */

const GOAL_AMOUNT = 10000000; // 목표 1,000만원

const WEEKLY_CONFIG = {
  1: {
    label: "1주차 (2/13~19)",
    question: "Q. 온유와 닮은 동물은?",
    start: "2026-02-13",
    end: "2026-02-19",
    options: [
      { name: "토끼", keywords: ["토끼"] },
      { name: "고양이", keywords: ["고양이", "냥"] },
      { name: "강아지", keywords: ["강아지", "댕댕", "멍멍"] },
      { name: "족제비", keywords: ["족제비", "쵹"] },
      { name: "오목눈이", keywords: ["오목눈이", "뱁새"] }
    ]
  },
  2: {
    label: "2주차 (2/20~26)",
    question: "Q. 온유는 온둡 vs 냉둡?!",
    start: "2026-02-20",
    end: "2026-02-26",
    options: [
      { name: "온둡", keywords: ["온둡", "따뜻"] },
      { name: "냉둡", keywords: ["냉둡", "차갑"] }
    ]
  },
  3: {
    label: "3주차 (2/27~3/5)",
    question: "Q. 이번 앨범티징 최애 컨포는?",
    start: "2026-02-27",
    end: "2026-03-05",
    options: [
      { name: "#🖤", keywords: ["🖤", "검정", "블랙"] },
      { name: "#💙", keywords: ["💙", "파랑", "블루"] },
      { name: "#❤️", keywords: ["❤️", "빨강", "레드"] },
      { name: "#🩷", keywords: ["🩷", "핑크", "분홍"] },
      { name: "#🤎", keywords: ["🤎", "갈색", "브라운"] },
      { name: "#💚", keywords: ["💚", "초록", "그린"] }
    ]
  },
  4: {
    label: "4주차 (3/6~12)",
    question: "Q. 이번 앨범 최애 수록곡 예상!",
    start: "2026-03-06",
    end: "2026-03-12",
    options: [
      { name: "TOUGH LOVE", keywords: ["TOUGH", "터프"] },
      { name: "X, Oh Why?", keywords: ["Why", "와이"] },
      { name: "Lie", keywords: ["Lie", "라이"] },
      { name: "Flex on me", keywords: ["Flex", "플렉스"] },
      { name: "Dot dot dot(…)", keywords: ["Dot", "닷", "점점점"] },
      { name: "???(추후수정)", keywords: ["히든"] }
    ]
  }
};

const formatNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// 숫자(0~N)를 두 자리 문자열 배열로 만드는 함수
const generateTimeOptions = (max) => {
  return Array.from({ length: max }, (_, i) => i.toString().padStart(2, '0'));
};

export default function FundraisingApp() {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [currentWeek, setCurrentWeek] = useState(1);
  const [transactions, setTransactions] = useState([]);

  // --- 입력 폼 상태 ---
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 시간 입력을 위한 상태
  const [hour, setHour] = useState('00');
  const [minute, setMinute] = useState('00');
  const [second, setSecond] = useState('00');
  
  const [inputName, setInputName] = useState('');
  const [inputAmount, setInputAmount] = useState('');

  // 시간 옵션 생성
  const hours = generateTimeOptions(24);
  const minutes = generateTimeOptions(60);
  const seconds = generateTimeOptions(60);

  useEffect(() => {
    const saved = localStorage.getItem('onew_fund_transactions_v2');
    if (saved) {
      setTransactions(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('onew_fund_transactions_v2', JSON.stringify(transactions));
  }, [transactions]);

  const getWeekByDate = (dateStr) => {
    for (const [week, config] of Object.entries(WEEKLY_CONFIG)) {
      if (dateStr >= config.start && dateStr <= config.end) {
        return parseInt(week);
      }
    }
    return 0;
  };

  const getOptionByName = (week, nameStr) => {
    if (!WEEKLY_CONFIG[week]) return "범위외";
    const config = WEEKLY_CONFIG[week];
    for (const opt of config.options) {
      if (opt.keywords.some(k => nameStr.includes(k))) {
        return opt.name;
      }
    }
    return "무효표";
  };

  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!inputName || !inputAmount || !inputDate) return;

    const amount = parseInt(inputAmount.replace(/[^0-9]/g, ''), 10);
    const week = getWeekByDate(inputDate);
    
    let option = "범위외";
    if (week > 0) {
      option = getOptionByName(week, inputName);
    }

    const paymentType = activeTab === 'paypal' ? 'PayPal' : '계좌이체';
    const finalTime = `${hour}:${minute}:${second}`;

    const newTx = {
      id: Date.now(),
      type: paymentType,
      date: inputDate,
      time: finalTime,
      name: inputName,
      amount: amount,
      week: week,
      option: option
    };

    setTransactions(prev => [newTx, ...prev]);
    setInputName('');
    setInputAmount('');
  };

  const handleDelete = (id) => {
    if(window.confirm("이 내역을 삭제하시겠습니까?")) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const stats = useMemo(() => {
    const weekTxs = transactions.filter(t => t.week === currentWeek);
    const optionSums = {};
    WEEKLY_CONFIG[currentWeek].options.forEach(opt => optionSums[opt.name] = 0);
    let invalidSum = 0;
    let weekTotal = 0;

    weekTxs.forEach(t => {
      weekTotal += t.amount;
      if (t.option === "무효표") {
        invalidSum += t.amount;
      } else if (optionSums[t.option] !== undefined) {
        optionSums[t.option] += t.amount;
      } else {
        invalidSum += t.amount; 
      }
    });

    const validTotal = weekTotal - invalidSum;

    const chartData = WEEKLY_CONFIG[currentWeek].options.map((opt, idx) => {
      const amt = optionSums[opt.name];
      const pct = validTotal > 0 ? ((amt / validTotal) * 100).toFixed(1) : 0;
      const colors = ["#86A5DC", "#D5A2A1", "#A6C1EE", "#E8C5C4", "#B0C4DE", "#F4C2C2"];
      return { 
        name: opt.name, 
        value: amt, 
        percent: pct, 
        color: colors[idx % colors.length] 
      };
    });

    const cumulativeTxs = transactions.filter(t => t.week > 0 && t.week <= currentWeek);
    const cumulativeTotal = cumulativeTxs.reduce((sum, t) => sum + t.amount, 0);
    const goalPercent = Math.min(100, (cumulativeTotal / GOAL_AMOUNT) * 100).toFixed(1);

    return { weekTotal, validTotal, invalidSum, chartData, cumulativeTotal, goalPercent };
  }, [transactions, currentWeek]);

  const downloadCSV = () => {
    const headers = ["결제수단", "날짜", "시간", "입금자명", "금액", "주차", "분류(선지)"];
    const rows = transactions.map(t => [t.type, t.date, t.time, t.name, t.amount, t.week > 0 ? `${t.week}주차` : "범위외", t.option]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `온유_모금정산_통합본_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const getPiePath = (percent, accumulatedPercent) => {
    const x = Math.cos(2 * Math.PI * accumulatedPercent);
    const y = Math.sin(2 * Math.PI * accumulatedPercent);
    const endX = Math.cos(2 * Math.PI * (accumulatedPercent + (percent/100)));
    const endY = Math.sin(2 * Math.PI * (accumulatedPercent + (percent/100)));
    const largeArcFlag = (percent/100) > 0.5 ? 1 : 0;
    return `M 0 0 L ${x} ${y} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
  };

  const currentList = useMemo(() => {
    if (activeTab === 'dashboard' || activeTab === 'graph') return [];
    const type = activeTab === 'paypal' ? 'PayPal' : '계좌이체';
    return transactions.filter(t => t.type === type);
  }, [activeTab, transactions]);

  const isGraphOnly = activeTab === 'graph';

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-0 sm:py-10 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[850px] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-gray-100">
        
        {/* 상단 탭 */}
        <div className="px-6 pt-6 pb-2 bg-white sticky top-0 z-30 border-b border-gray-100">
          <h1 className="text-center text-lg font-black text-[#86A5DC] tracking-widest mb-4">ONEW FUND MANAGER</h1>
          <div className="flex bg-gray-100 p-1 rounded-2xl mb-2">
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}
            >
              <LayoutDashboard size={14} /> 현황판
            </button>
            <button 
              onClick={() => setActiveTab('graph')} 
              className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${activeTab === 'graph' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}
            >
              <BarChart3 size={14} /> 그래프
            </button>
            <button 
              onClick={() => setActiveTab('bank')} 
              className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${activeTab === 'bank' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}
            >
              <CreditCard size={14} /> 원화
            </button>
            <button 
              onClick={() => setActiveTab('paypal')} 
              className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${activeTab === 'paypal' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}
            >
              <Wallet size={14} /> PayPal
            </button>
          </div>
        </div>

        {/* --- 탭 1 & 2: 현황판 & 그래프 --- */}
        {(activeTab === 'dashboard' || activeTab === 'graph') && (
          <div className="flex-1 px-6 pb-10 overflow-y-auto">
            <div className="flex justify-between items-center my-4 overflow-x-auto">
              {[1, 2, 3, 4].map(w => (
                <button 
                  key={w}
                  onClick={() => setCurrentWeek(w)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap mr-2 transition-colors ${currentWeek === w ? 'bg-[#D5A2A1] text-white' : 'bg-gray-100 text-gray-400'}`}
                >
                  {w}주차
                </button>
              ))}
            </div>

            <div className="bg-white border-2 border-[#86A5DC]/20 rounded-3xl p-5 relative overflow-hidden shadow-sm mb-6">
              
              <div className="text-center mb-3">
                <span className="inline-block px-2 py-0.5 rounded bg-[#86A5DC]/10 text-[#86A5DC] text-[10px] font-bold mb-1">
                  {WEEKLY_CONFIG[currentWeek].label}
                </span>
                <h2 className="text-base font-bold text-gray-900">{WEEKLY_CONFIG[currentWeek].question}</h2>
              </div>

              <div className="flex items-center justify-center mb-6">
                {stats.validTotal > 0 ? (
                  <div className="relative w-48 h-48">
                    <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                      {(() => {
                        let acc = 0;
                        return stats.chartData.map((item, idx) => {
                          const pct = parseFloat(item.percent);
                          const path = getPiePath(pct, acc);
                          acc += pct / 100;
                          return <path key={idx} d={path} fill={item.color} stroke="white" strokeWidth="0.05" />;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                      <span className="text-[9px] text-gray-400 font-bold">
                        {isGraphOnly ? "투표 참여" : "이번주 모금"}
                      </span>
                      {isGraphOnly ? (
                         <span className="text-sm font-black text-[#D5A2A1]">ON GOING</span>
                      ) : (
                         <span className="text-sm font-black text-gray-800">{formatNum(stats.weekTotal)}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-full bg-gray-100 flex flex-col items-center justify-center text-gray-400 text-xs">
                    <p>데이터 없음</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {stats.chartData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: item.color}} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-600 truncate font-bold">{item.name}</span>
                        <span className="text-[10px] font-black text-[#86A5DC]">{item.percent}%</span>
                      </div>
                      {!isGraphOnly && (
                        <p className="text-[9px] text-gray-400 text-right">{formatNum(item.value)}원</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

               {!isGraphOnly && (
                 <div className="text-right text-[10px] text-gray-400 mb-3">
                   * 무효표/기타: {formatNum(stats.invalidSum)}원 (집계 제외)
                 </div>
               )}

              <div className="border-t-2 border-dashed border-gray-100 pt-2">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-[#D5A2A1]">TOTAL PROGRESS</span>
                  <span className="text-xl font-black text-[#D5A2A1]">{stats.goalPercent}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-[#D5A2A1] to-[#E8C5C4] relative"
                    style={{ width: `${stats.goalPercent}%` }}
                  ></div>
                </div>
                {!isGraphOnly && (
                  <div className="flex justify-between mt-1 text-[9px] font-bold text-gray-400">
                    <span>누적 {formatNum(stats.cumulativeTotal)}원</span>
                    <span>목표 1,000만원</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-right mb-4">
               <button onClick={downloadCSV} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                  <Download size={12} /> 통합 내역 저장 (CSV)
                </button>
            </div>
          </div>
        )}

        {/* --- 탭 3 & 4: 입력 폼 (원화/페이팔) --- */}
        {(activeTab === 'bank' || activeTab === 'paypal') && (
          <div className="flex-1 px-4 pb-4 overflow-hidden flex flex-col">
            
            <form onSubmit={handleAddTransaction} className={`p-4 rounded-2xl mb-4 shrink-0 border transition-colors ${activeTab === 'paypal' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200'}`}>
              <h3 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                <Plus size={12} /> {activeTab === 'paypal' ? 'PayPal 내역 추가' : '원화 입금 내역 추가'}
              </h3>
              
              {/* [수정] 날짜(고정폭 w-28)와 시간(나머지) 칸을 한 줄에 배치하고 높이(h-34px) 통일 */}
              <div className="flex gap-2 mb-2">
                <div className="w-28 shrink-0">
                    <label className="text-[9px] text-gray-400 block mb-1">날짜</label>
                    <input 
                      type="date" 
                      required
                      value={inputDate}
                      onChange={(e) => setInputDate(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white h-[34px]"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-[9px] text-gray-400 block mb-1">시간 (시:분:초)</label>
                    <div className="flex gap-1">
                        <select 
                          value={hour}
                          onChange={(e) => setHour(e.target.value)}
                          className="flex-1 text-xs py-1.5 px-0 text-center rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white appearance-none h-[34px]"
                        >
                           {hours.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="self-center text-gray-400 text-[10px]">:</span>
                        <select 
                          value={minute}
                          onChange={(e) => setMinute(e.target.value)}
                          className="flex-1 text-xs py-1.5 px-0 text-center rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white appearance-none h-[34px]"
                        >
                           {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <span className="self-center text-gray-400 text-[10px]">:</span>
                        <select 
                          value={second}
                          onChange={(e) => setSecond(e.target.value)}
                          className="flex-1 text-xs py-1.5 px-0 text-center rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white appearance-none h-[34px]"
                        >
                           {seconds.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
              </div>
              
              <div className="mb-2">
                 <label className="text-[9px] text-gray-400 block mb-1">입금자명 (투표 내용)</label>
                 <input 
                    type="text" 
                    required
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="예: 이진기토끼"
                    className="w-full text-xs p-2 rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white"
                  />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                   <input 
                      type="text" 
                      required
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      placeholder="금액 (원)"
                      className="w-full text-xs p-2 rounded-lg border border-white focus:outline-none focus:border-[#86A5DC] bg-white"
                    />
                </div>
                <button type="submit" className="bg-[#86A5DC] text-white px-4 rounded-lg text-xs font-bold hover:bg-[#7a95c9]">
                  추가
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-500 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="p-3">날짜/시간</th>
                    <th className="p-3">입금자</th>
                    <th className="p-3">금액</th>
                    <th className="p-3">분류</th>
                    <th className="p-3 text-center">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentList.length > 0 ? (
                    currentList.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/50">
                        <td className="p-3 text-gray-400">
                          <div className="font-bold">{t.date.slice(5)}</div>
                          <div className="text-[9px]">{t.time}</div>
                        </td>
                        <td className="p-3 font-medium text-gray-700">{t.name}</td>
                        <td className="p-3 text-gray-900">{formatNum(t.amount)}</td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${t.option === '무효표' || t.option === '범위외' ? 'bg-gray-200 text-gray-500' : 'bg-[#86A5DC]/10 text-[#86A5DC] font-bold'}`}>
                            {t.option}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-10 text-center text-gray-300">
                        입력된 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}