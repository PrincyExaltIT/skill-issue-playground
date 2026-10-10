import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SpeakerService {
  private baseUrl = 'http://localhost:3000/api/speakers';

  constructor(private http: HttpClient) {}

  getSpeaker(id: string): Observable<any> {
    console.log('getSpeaker', id);
    return this.http.get(`${this.baseUrl}/${id}`);
  }

  getTalks(speakerId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${speakerId}/talks`);
  }
}
