import { useEffect } from 'react'

/**
 * 玩法说明：掼蛋的规矩不少（级牌、逢人配、进贡还贡、同花顺、下游那队…），
 * 大厅里给一张说明单，新玩家不用去问人。
 */
const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: '一桌怎么打',
    items: [
      '四人两队，对家是搭档：座位 0/2 一队，1/3 一队',
      '每局第一手由上一局的头游先出（进贡局例外，见下）',
      '一轮里可以「过」；一轮没人出牌后，由最后出牌的人重新领出',
      '手里牌出完就算走完；一局里第一个走完的是头游，依次是二游、三游、四游',
    ],
  },
  {
    title: '级牌与升级',
    items: [
      '每队一个级牌，从 2 级开始，一直升到 A 级',
      '级牌比 A 大；级牌不能当自己的点数出（顺子、连对里按它原来的点数算）',
      '头游那队升级：1+2 双下升 3 级，1+3 升 2 级，1+4 升 1 级',
      '打到 A 级要双下（1+2 名同队）才算拿下整场',
      '一局里最后一名是「下游」，下游那队下一局赢不了整场',
    ],
  },
  {
    title: '进贡与还贡',
    items: [
      '每局之间要进贡：上局的下游要向上游交一张最大的牌',
      '上一局出现双下游时，三游与四游各交一张',
      '上游收到贡牌后，要还一张 10 以下的牌',
      '手里有双王（大王小王）可以「抗贡」，不用交牌',
      '进贡在局与局之间做一次；进贡后由进贡的下游先出牌（都抗贡就由头游领出）',
    ],
  },
  {
    title: '逢人配',
    items: [
      '红桃级牌是「逢人配」，可以当任意点数搭配使用',
      '比如 2 级时，红桃 2 能凑成对 5、三带二里的两张',
      '逢人配是万能牌，不是级牌本身（级牌该多大还多大）',
    ],
  },
  {
    title: '牌型',
    items: [
      '单张、对子、三张、三带二、顺子（正好 5 张）、连对（3 对以上）、钢板（连续三张）',
      '顺子与连对里 A 既能当最大的也能当最小的（A2345 算顺子）',
      '炸弹（4 张及以上同点）压一切常规牌型',
      '同花顺（同点数的顺子且同花色）压 5 张及以下的炸弹，6 张以上的炸弹压同花顺',
      '天炸（大小王共四张）最大，压得住同花顺',
    ],
  },
  {
    title: '报牌与提示',
    items: [
      '手里剩 10 张以内要报牌（牌桌上会标出来）',
      '「牌谱」能看这一局每一手出的真实牌面',
      '「提示」会按 AI 的走法替你选好牌',
      '「记牌器」显示对面可能还剩多少张某个点数',
    ],
  },
]

export function HelpSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-ground/85 px-4"
      onClick={onClose}
      data-testid="help-sheet"
    >
      <div
        className="panel my-auto max-h-[86vh] w-[560px] max-w-full overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-ink">玩法说明</h2>
          <button
            className="btn btn-secondary btn-sm ml-auto"
            onClick={onClose}
            data-testid="help-close"
          >
            关闭
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h3 className="text-[15px] font-semibold text-ink">{s.title}</h3>
              <ul className="mt-2 space-y-1.5">
                {s.items.map((it) => (
                  <li key={it} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                    <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-faint" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-6 border-t border-rule pt-3 text-[12px] text-faint">
          规则按官方淮安/江苏掼蛋竞赛规则实现；有出入以当地牌规为准。
        </p>
      </div>
    </div>
  )
}
