/* eslint-disable */
import React from 'react'
import { FileText } from 'lucide-react'
import { MeetingList } from './MeetingList'
import { CabinetProceedings } from './CabinetProceedings'
import { CabinetConclusions } from './CabinetConclusions'
import { CabinetNotebook } from './CabinetNotebook'

export function CabinetMeetings({ activeTab }) {
  if (activeTab === 0) {
    return <MeetingList />
  }
  if (activeTab === 1) {
    return <CabinetProceedings />
  }
  if (activeTab === 2) {
    return <CabinetConclusions />
  }
  if (activeTab === 3) {
    return <CabinetNotebook />
  }

  // Fallback
  return <MeetingList />
}
