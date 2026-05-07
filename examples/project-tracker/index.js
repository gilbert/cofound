import s from 'cos'
import Sheet from 'co-sheets'

const tabs = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'projects', label: 'Projects' },
  { key: 'team_members', label: 'Team' },
]

let currentTab = 'tasks'

s.mount(() => {
  return s`max-width 960px; m 40px auto; font-family system-ui, sans-serif`(
    s`h2 m 0 0 16px; font-weight 600; font-size 20px; c #1f2937`('Project Tracker'),
    // Tab bar
    s`d flex; gap 0; mb 20px; border-bottom 2px solid #e5e7eb`(
      tabs.map(tab =>
        s`button
          p 8px 20px
          bc transparent
          border none
          border-bottom 2px solid ${currentTab === tab.key ? '#2563eb' : 'transparent'}
          c ${currentTab === tab.key ? '#2563eb' : '#6b7280'}
          font-weight ${currentTab === tab.key ? '600' : '400'}
          font-size 14px
          cursor pointer
          margin-bottom -2px
          &:hover { c #2563eb }
        `({
          onclick: () => { currentTab = tab.key }
        }, tab.label)
      )
    ),
    // Sheet for current tab
    Sheet('/api', currentTab)
  )
})
