export const VOTE_TYPES = {
  pk: '双选PK',
  multiple: '多选',
  single: '单选'
}

export const VOTE_STATES = {
  未开始: {
    state: '未开始',
    color: 'orange'
  },
  进行中: {
    state: '进行中',
    color: 'green'
  },
  已结束: {
    state: '已结束',
    color: 'red'
  }
}

export default {
  VOTE_TYPES,
  VOTE_STATES
}
