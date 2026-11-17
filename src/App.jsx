import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs, writeBatch } from 'firebase/firestore';
import { Zap, Shield, Brain, Activity, Target, Plus, AlertCircle, Terminal, Sword, Ghost, Flame, Skull } from 'lucide-react';
import './index.css';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = firebaseConfig.appId;

const XP_BASE = 100;
const XP_MULTIPLIER = 1.15;
const getRequiredXp = (level) => Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, level - 1));

const EXERCISES = ['Push-ups', 'Sit-ups', 'Squats', 'Running (km)'];

const getQuestTargetsForLevel = (level) => {
  if (level >= 100 || level === 40) return null;

  let reps = 25;
  let runKm = 2.5;

  if (level >= 10 && level <= 24) { reps = 37; runKm = 3.7; }
  else if (level >= 25 && level <= 39) { reps = 50; runKm = 5.0; }
  else if (level >= 41 && level <= 69) { reps = 67; runKm = 6.7; }
  else if (level >= 70 && level <= 84) { reps = 75; runKm = 7.5; }
  else if (level >= 85 && level <= 99) { reps = 100; runKm = 10.0; }

  return [
    { id: 'q1', text: 'Push-ups', current: 0, target: reps, extraReps: 0, maxExtra: 15, completed: false, xpReward: 25 },
    { id: 'q2', text: 'Sit-ups', current: 0, target: reps, extraReps: 0, maxExtra: 15, completed: false, xpReward: 25 },
    { id: 'q3', text: 'Squats', current: 0, target: reps, extraReps: 0, maxExtra: 15, completed: false, xpReward: 25 },
    { id: 'q4', text: 'Running (km)', current: 0, target: runKm, extraReps: 0, maxExtra: 15, completed: false, xpReward: 25 },
  ];
};

const DEFAULT_STATS = {
  level: 1, job: 'None', title: 'None',
  hp: 100, maxHp: 100, mp: 20, maxMp: 20, xp: 0, gold: 0,
  str: 10, agi: 10, sen: 10, vit: 10, int: 10, ap: 0, 
  acceptedSystem: false, inPenaltyZone: false, penaltyTask: null,
  lastLoginDate: new Date().toDateString()
};

const MILESTONES_DB = {
  10: { title: 'Wolf Slayer', msg: 'INSTANT DUNGEON CLEARED: WOLF SLAYER TITLE ACQUIRED (+5 STR/AGI)' },
  20: { title: 'Murderous Intent', msg: 'SPECIAL QUEST COMPLETE: MURDEROUS INTENT UNLOCKED' },
  40: { job: 'Shadow Monarch', title: 'The One Who Overcame Adversity', msg: 'JOB CHANGE QUEST COMPLETE: PROMOTED TO SHADOW MONARCH' },
  70: { title: 'Demon Hunter', msg: 'DEMON CASTLE CLEARED: DEMON HUNTER TITLE ACQUIRED' },
  100: { job: 'True Shadow Monarch', title: 'Monarch of Shadows', msg: 'CARTENON TEMPLE CLEARED: BLACK HEART ACQUIRED. MAXIMUM LEVEL REACHED.' }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('status'); 
  const [systemMessage, setSystemMessage] = useState(null);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsubStats = () => {}, unsubQuests = () => {};

    const initializeData = async () => {
      const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'status');
      const questsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'quests');
      const today = new Date().toDateString();

      const statsSnap = await getDoc(statsRef);
      let currentStats = DEFAULT_STATS;

      if (!statsSnap.exists()) {
        await setDoc(statsRef, DEFAULT_STATS);
      } else {
        currentStats = statsSnap.data();
        if (currentStats.lastLoginDate !== today) {
          const questsSnap = await getDocs(questsCollection);
          let failed = false;
          questsSnap.forEach(q => { if (!q.data().completed) failed = true; });

          const randomExercise = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
          const batch = writeBatch(db);

          batch.update(statsRef, { 
            lastLoginDate: today, 
            inPenaltyZone: failed,
            penaltyTask: failed ? { exercise: randomExercise, target: 150, current: 0 } : null
          });

          const newQuests = getQuestTargetsForLevel(currentStats.level);
          if (newQuests) {
            newQuests.forEach(q => batch.set(doc(questsCollection, q.id), q));
          }

          await batch.commit();

          if (failed) showSystemMessage(`PENALTY QUEST INITIATED: SURVIVE 150 ${randomExercise.toUpperCase()}!`);
          else showSystemMessage("DAILY QUESTS HAVE BEEN RESET.");
        }
      }

      const questsSnap = await getDocs(questsCollection);
      if (questsSnap.empty) {
        const initialQuests = getQuestTargetsForLevel(currentStats.level || 1);
        if (initialQuests) {
          const batch = writeBatch(db);
          initialQuests.forEach(q => batch.set(doc(questsCollection, q.id), q));
          await batch.commit();
        }
      }

      unsubStats = onSnapshot(statsRef, doc => doc.exists() && setStats(doc.data()));
      unsubQuests = onSnapshot(questsCollection, snapshot => {
        const fetched = [];
        snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() }));
        fetched.sort((a, b) => a.id.localeCompare(b.id));
        setQuests(fetched);
        setLoading(false);
      });
    };

    initializeData();
    return () => { unsubStats(); unsubQuests(); };
  }, [user]);

  const showSystemMessage = (msg, duration = 4000) => {
    setSystemMessage(msg);
    setTimeout(() => setSystemMessage(null), duration);
  };

  const handleAcceptSystem = async () => {
    if (!user) return;
    const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'status');
    await updateDoc(statsRef, { acceptedSystem: true });
    showSystemMessage("PLAYER REGISTRATION COMPLETE.");
  };

  const checkMilestones = async (level, currentStats, statsRef) => {
    const milestone = MILESTONES_DB[level];
    if (milestone) {
      const updates = {};
      if (milestone.title) updates.title = milestone.title;
      if (milestone.job) updates.job = milestone.job;
      if (level === 100) {
        updates.maxMp = (currentStats.maxMp || 20) + 100000;
        updates.mp = updates.maxMp;
      }
      await updateDoc(statsRef, updates);
      showSystemMessage(milestone.msg, 6000);
    }
  };

  const awardXpAndLevelUp = async (xpReward) => {
    let newXp = stats.xp + xpReward;
    let newLevel = stats.level;
    let newAp = stats.ap;
    let newMaxHp = stats.maxHp;
    let hp = stats.hp;
    let reqXp = getRequiredXp(newLevel);
    let leveledUp = false;

    while (newXp >= reqXp && newLevel < 100) {
      newXp -= reqXp; 
      newLevel++; 
      newAp += 5; 
      newMaxHp += 20; 
      hp = newMaxHp; 
      leveledUp = true;
      reqXp = getRequiredXp(newLevel);
    }

    const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'status');
    await updateDoc(statsRef, { xp: newXp, level: newLevel, ap: newAp, hp: hp, maxHp: newMaxHp });
    
    if (leveledUp) {
      showSystemMessage(`LEVEL UP! YOU ARE NOW LEVEL ${newLevel}! (+5 AP)`);
      setTimeout(() => checkMilestones(newLevel, stats, statsRef), 2000);
    }
  };

  const handleLogProgress = async (quest, addedValue) => {
    if (!user || !stats || addedValue <= 0) return;

    const questRef = doc(db, 'artifacts', appId, 'users', user.uid, 'quests', quest.id);
    const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'status');

    if (!quest.completed) {
      const neededForTarget = quest.target - quest.current;

      if (addedValue <= neededForTarget) {
        const newCurrent = quest.current + addedValue;
        if (newCurrent >= quest.target) {
          await updateDoc(questRef, { current: quest.target, completed: true });
          await awardXpAndLevelUp(quest.xpReward);
        } else {
          await updateDoc(questRef, { current: newCurrent });
        }
      } else {
        const overflowReps = addedValue - neededForTarget;
        const currentExtra = quest.extraReps || 0;
        const allowedExtra = Math.min(overflowReps, quest.maxExtra - currentExtra);

        await updateDoc(questRef, {
          current: quest.target,
          completed: true,
          extraReps: currentExtra + Math.max(0, allowedExtra)
        });

        let totalXpBonus = quest.xpReward;
        if (allowedExtra > 0) {
          const extraXp = allowedExtra * 2;
          const hpHeal = allowedExtra * 5;
          const newHp = Math.min(stats.maxHp, stats.hp + hpHeal);
          totalXpBonus += extraXp;

          await updateDoc(statsRef, { hp: newHp });
          showSystemMessage(`EXTRA REPS BONUS: +${extraXp} BONUS XP & +${hpHeal} HP RESTORED!`);
        }
        await awardXpAndLevelUp(totalXpBonus);
      }
    } else {
      const currentExtra = quest.extraReps || 0;
      const allowedExtra = Math.min(addedValue, quest.maxExtra - currentExtra);

      if (allowedExtra > 0) {
        await updateDoc(questRef, { extraReps: currentExtra + allowedExtra });
        const extraXp = allowedExtra * 2;
        const hpHeal = allowedExtra * 5;
        const newHp = Math.min(stats.maxHp, stats.hp + hpHeal);

        await updateDoc(statsRef, { hp: newHp });
        showSystemMessage(`EXTRA REPS BONUS: +${extraXp} BONUS XP & +${hpHeal} HP RESTORED!`);
        await awardXpAndLevelUp(extraXp);
      } else {
        showSystemMessage("EXTRA REPS CAP REACHED (MAX 15 EXTRAS PER QUEST).");
      }
    }
  };

  const handleLogPenaltyProgress = async (reps) => {
    if (!user || !stats || !stats.penaltyTask || reps <= 0) return;
    const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'status');
    const newCurrent = Math.min((stats.penaltyTask.current || 0) + reps, stats.penaltyTask.target);

    if (newCurrent >= stats.penaltyTask.target) {
      await updateDoc(statsRef, { inPenaltyZone: false, penaltyTask: null });
      showSystemMessage("PENALTY ZONE SURVIVED. SYSTEM RESTORED.");
    } else {
      await updateDoc(statsRef, { 'penaltyTask.current': newCurrent });
    }
  };

  const handleAddStat = async (statName) => {
    if (!user || !stats || stats.ap <= 0) return;
    const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'status');
    await updateDoc(statsRef, { [statName]: stats[statName] + 1, ap: stats.ap - 1 });
  };

  if (loading) return <div className="min-h-screen bg-[#02040a] flex items-center justify-center text-blue-500 animate-pulse text-2xl font-mono tracking-[0.3em]">INITIALIZING SYSTEM...</div>;

  if (stats && !stats.acceptedSystem) {
    return (
      <div className="min-h-screen bg-[#02040a] text-blue-100 font-mono flex items-center justify-center p-4">
        <div className="max-w-md w-full border-2 border-blue-600/60 bg-[#0a0f1c] p-6 text-center space-y-6 shadow-[0_0_50px_rgba(37,99,235,0.3)]">
          <div className="flex justify-center items-center gap-2 text-blue-400 font-bold tracking-widest"><AlertCircle size={28} /><h1>NOTIFICATION</h1></div>
          <div className="space-y-2">
            <p className="text-blue-200">Your heart will stop in <span className="text-red-500 font-bold">0.02 seconds</span> if you decline.</p>
            <h2 className="text-xl font-bold text-white tracking-wider">Will you accept?</h2>
          </div>
          <div className="flex gap-4">
            <button onClick={handleAcceptSystem} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 tracking-widest transition-all">YES</button>
            <button onClick={() => alert("PENALTY IMMINENT.")} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3 tracking-widest transition-all">NO</button>
          </div>
        </div>
      </div>
    );
  }

  if (stats && stats.inPenaltyZone && stats.penaltyTask) {
    const { exercise, target, current } = stats.penaltyTask;
    const percent = Math.min(100, Math.max(0, (current / target) * 100));

    return (
      <div className="min-h-screen bg-[#0d0202] text-red-500 font-mono p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-red-950/20 animate-pulse"></div>
        <div className="z-10 text-center space-y-6 max-w-xl border-2 border-red-600 bg-[#1a0505] p-8 shadow-[0_0_50px_rgba(220,38,38,0.5)] w-full">
          <Skull size={64} className="mx-auto text-red-500 animate-bounce" />
          <h1 className="text-4xl font-bold tracking-[0.3em] text-red-500 glow-red">PENALTY ZONE</h1>
          <p className="text-red-300 text-sm tracking-widest">YOU FAILED TO COMPLETE YESTERDAY'S DAILY QUESTS.</p>
          
          <div className="p-6 bg-red-950/50 border border-red-800 space-y-4">
            <p className="text-sm font-bold text-red-400 tracking-wider uppercase">SURVIVAL TASK: {target} {exercise.toUpperCase()}</p>
            <div className="space-y-2">
              <div className="h-4 w-full bg-black border border-red-900 overflow-hidden">
                <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${percent}%` }}></div>
              </div>
              <p className="text-xs text-red-400 font-mono">{current} / {target} REPS COMPLETED</p>
            </div>
            <PenaltyInput onLog={handleLogPenaltyProgress} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#02040a] text-blue-100 font-mono p-4 md:p-8 flex justify-center items-start relative">
      <div className="relative w-full max-w-4xl border-[3px] border-blue-600/40 bg-[#0a0f1c]/90 backdrop-blur-xl rounded shadow-[0_0_50px_rgba(37,99,235,0.25)] overflow-hidden flex flex-col z-10 my-auto">
        
        <div className="flex border-b border-blue-600/40 bg-[#050811]">
          <button onClick={() => setActiveTab('status')} className={`flex-1 p-4 font-bold tracking-[0.2em] ${activeTab === 'status' ? 'bg-blue-900/40 text-blue-300 border-b-4 border-blue-500' : 'text-slate-600'}`}>STATUS</button>
          <button onClick={() => setActiveTab('quests')} className={`flex-1 p-4 font-bold tracking-[0.2em] ${activeTab === 'quests' ? 'bg-blue-900/40 text-blue-300 border-b-4 border-blue-500' : 'text-slate-600'}`}>DAILY QUESTS</button>
          <button onClick={() => setActiveTab('raids')} className={`flex-1 p-4 font-bold tracking-[0.2em] ${activeTab === 'raids' ? 'bg-blue-900/40 text-blue-300 border-b-4 border-blue-500' : 'text-slate-600'}`}>DUNGEONS</button>
          {stats && stats.level >= 40 && (
            <button onClick={() => setActiveTab('shadows')} className={`flex-1 p-4 font-bold tracking-[0.2em] ${activeTab === 'shadows' ? 'bg-purple-900/40 text-purple-300 border-b-4 border-purple-500' : 'text-slate-600'}`}>SHADOW ARMY</button>
          )}
        </div>

        {systemMessage && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-pulse">
            <div className="bg-[#0f172a] border-2 border-blue-500 text-blue-200 px-6 py-3 shadow-[0_0_30px_rgba(59,130,246,0.8)] text-center">
              <p className="font-bold tracking-[0.2em] text-sm uppercase">{systemMessage}</p>
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 min-h-[550px]">
          {activeTab === 'status' && stats && <StatusPanel stats={stats} onAddStat={handleAddStat} />}
          {activeTab === 'quests' && <QuestPanel quests={quests} level={stats?.level || 1} onLogProgress={handleLogProgress} />}
          {activeTab === 'raids' && <RaidsPanel level={stats?.level || 1} onAwardXp={awardXpAndLevelUp} />}
          {activeTab === 'shadows' && <ShadowArmyPanel level={stats?.level || 1} />}
        </div>
      </div>
    </div>
  );
}

function StatusPanel({ stats, onAddStat }) {
  const reqXp = getRequiredXp(stats.level);
  const xpPercent = Math.min(100, (stats.xp / reqXp) * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#0f172a]/50 p-4 border border-blue-900/50">
        <div><p className="text-slate-500 text-xs uppercase">Name</p><p className="text-xl font-bold text-white">Sung Jin-Woo</p></div>
        <div><p className="text-slate-500 text-xs uppercase">Level</p><p className="text-2xl font-bold text-blue-400">{stats.level} / 100</p></div>
        <div><p className="text-slate-500 text-xs uppercase">Job</p><p className="text-lg text-purple-400 font-bold">{stats.job}</p></div>
        <div><p className="text-slate-500 text-xs uppercase">Title</p><p className="text-lg text-amber-400 font-bold">{stats.title}</p></div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1"><span className="text-red-500 font-bold">HP</span><span>{stats.hp} / {stats.maxHp}</span></div>
          <div className="h-3 bg-[#050505] border border-red-900/30"><div className="h-full bg-red-600" style={{ width: `${(stats.hp/stats.maxHp)*100}%` }}></div></div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1"><span className="text-blue-500 font-bold">MP</span><span>{stats.mp} / {stats.maxMp}</span></div>
          <div className="h-3 bg-[#050505] border border-blue-900/30"><div className="h-full bg-blue-600" style={{ width: `${(stats.mp/stats.maxMp)*100}%` }}></div></div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1"><span className="text-amber-500 font-bold">XP</span><span>{stats.xp} / {reqXp}</span></div>
          <div className="h-2 bg-[#050505]"><div className="h-full bg-amber-500" style={{ width: `${xpPercent}%` }}></div></div>
        </div>
      </div>

      <div className="pt-4 border-t border-blue-900/50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl text-blue-400 font-bold tracking-widest">ATTRIBUTES</h3>
          <span className="text-xs px-3 py-1 border border-amber-500/50 text-amber-400">AP AVAILABLE: {stats.ap}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {['str', 'agi', 'sen', 'vit', 'int'].map(st => (
            <div key={st} className="flex justify-between items-center p-3 bg-[#0a0f1c] border border-blue-900/40">
              <span className="uppercase text-slate-400 tracking-wider text-sm">{st}</span>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-white">{stats[st]}</span>
                <button onClick={() => onAddStat(st)} disabled={stats.ap <= 0} className="px-2 py-1 bg-blue-900/30 border border-blue-500/50 text-blue-300 disabled:opacity-30">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestPanel({ quests, level, onLogProgress }) {
  const [inputs, setInputs] = useState({});

  if (level === 40) {
    return (
      <div className="text-center py-12 space-y-4">
        <h2 className="text-2xl text-purple-400 font-bold tracking-widest">MANDATORY TRIAL ACTIVE</h2>
        <p className="text-slate-400 text-sm">Daily quests are suspended during Level 40. Complete the Job Change Instance under Dungeons to ascend.</p>
      </div>
    );
  }

  if (level >= 100) {
    return (
      <div className="text-center py-12 space-y-4">
        <h2 className="text-2xl text-amber-400 font-bold tracking-widest">MAXIMUM LEVEL REACHED</h2>
        <p className="text-slate-400 text-sm">You have conquered the System. Daily quests are permanently disabled.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl text-amber-500 font-bold tracking-widest border-l-4 border-amber-500 pl-3">DAILY QUEST: PREPARATION FOR POWER</h2>
      {quests.map(q => (
        <div key={q.id} className="p-4 bg-[#0a0f1c] border border-blue-900/40 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className={`font-bold ${q.completed ? 'text-amber-400' : 'text-blue-100'}`}>
              {q.text} {q.completed && '(COMPLETED)'}
            </span>
            <span className="text-amber-500 text-xs">+{q.xpReward} XP {q.extraReps > 0 && `(+${q.extraReps * 2} BONUS XP)`}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-grow h-2 bg-black overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(q.current/q.target)*100}%` }}></div>
            </div>
            <span className="text-xs text-slate-400">{q.current}/{q.target} {q.extraReps > 0 && `[+${q.extraReps} extra]`}</span>
          </div>
          <div className="flex gap-2 mt-2">
            <input type="number" min="1" placeholder={q.completed ? "Extra Reps" : "Reps"} value={inputs[q.id] || ''} onChange={e => setInputs({...inputs, [q.id]: e.target.value})} className="bg-black border border-blue-900 px-2 py-1 text-xs w-24 text-white focus:outline-none focus:border-blue-500" />
            <button onClick={() => { onLogProgress(q, parseInt(inputs[q.id])||0); setInputs({...inputs, [q.id]: ''}); }} className="bg-blue-900/40 border border-blue-500 px-4 py-1 text-xs font-bold text-blue-300 hover:bg-blue-800/50 transition-all">
              {q.completed ? 'LOG EXTRA' : 'LOG'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RaidsPanel({ level, onAwardXp }) {
  const dungeons = [
    { minLvl: 10, name: 'Hapjeong Station (E-Rank)', boss: 'Blue Venom Kasaka', xp: 200 },
    { minLvl: 25, name: 'C-Rank Spider Lair', boss: 'Giant Arachnid / Kang Taeshik', xp: 500 },
    { minLvl: 40, name: 'Job Change Instance', boss: 'Commander Igris', xp: 1200 },
    { minLvl: 70, name: "Demon's Castle (Top Floor)", boss: 'Demon King Baran', xp: 3500 },
    { minLvl: 100, name: 'Cartenon Temple', boss: 'Architect Kandiaru', xp: 10000 }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl text-blue-400 font-bold tracking-widest border-l-4 border-blue-500 pl-3">INSTANCED DUNGEONS</h2>
      <div className="grid gap-4">
        {dungeons.map((d, i) => {
          const unlocked = level >= d.minLvl;
          return (
            <div key={i} className={`p-4 border ${unlocked ? 'bg-[#0a0f1c] border-blue-600/50' : 'bg-black/60 border-slate-800 opacity-50'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-lg text-white">{d.name}</h4>
                  <p className="text-xs text-slate-400">Boss: {d.boss} | Req. Level: {d.minLvl}</p>
                </div>
                {unlocked ? (
                  <button onClick={() => onAwardXp(d.xp)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 font-bold text-xs tracking-wider">RAID (+{d.xp} XP)</button>
                ) : (
                  <span className="text-xs text-red-500 font-bold">LOCKED</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShadowArmyPanel({ level }) {
  const shadows = [
    { name: 'Igris', rank: 'Knight Grade', lvlReq: 40 },
    { name: 'Tank', rank: 'Elite Grade', lvlReq: 50 },
    { name: 'Tusk', rank: 'Elite Knight Grade', lvlReq: 70 },
    { name: 'Beru', rank: 'Commander Grade', lvlReq: 85 }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl text-purple-400 font-bold tracking-widest border-l-4 border-purple-500 pl-3">SHADOW MONARCH ARMY</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shadows.map((s, i) => {
          const extracted = level >= s.lvlReq;
          return (
            <div key={i} className={`p-4 border ${extracted ? 'bg-purple-950/20 border-purple-600/50' : 'bg-black border-slate-900 opacity-40'}`}>
              <div className="flex items-center gap-3">
                <Ghost className={extracted ? 'text-purple-400' : 'text-slate-700'} />
                <div>
                  <h4 className="font-bold text-purple-200">{s.name}</h4>
                  <p className="text-xs text-purple-400/70">{s.rank}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PenaltyInput({ onLog }) {
  const [val, setVal] = useState('');
  const handleSubmit = () => {
    const num = parseInt(val);
    if (num > 0) {
      onLog(num);
      setVal('');
    }
  };

  return (
    <div className="flex gap-2 justify-center pt-2">
      <input 
        type="number" 
        min="1" 
        placeholder="Reps" 
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="bg-black border border-red-800 text-red-200 px-3 py-2 w-28 text-center font-mono focus:outline-none focus:border-red-500"
      />
      <button 
        onClick={handleSubmit} 
        className="bg-red-700 hover:bg-red-600 text-white font-bold px-6 py-2 tracking-widest transition-all"
      >
        LOG REPS
      </button>
    </div>
  );
}