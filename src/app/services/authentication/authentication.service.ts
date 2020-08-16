import { Injectable, NgZone } from '@angular/core';
import { Platform } from "@ionic/angular";
import { Facebook } from "@ionic-native/facebook/ngx";
import { LoadingController } from '@ionic/angular';
import { BehaviorSubject, Observable } from "rxjs";
import * as firebase from 'firebase/app';
import "@firebase/auth";
import { AngularFirestore } from '@angular/fire/firestore';

import { Router } from '@angular/router';
// import user interface 
import { User } from '../../interfaces/user.interface';
@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  public loggedIn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
 
  allUsersByRoleAndRegion: Observable<User[]>;

  allUsers:any[];

  private db: any;

  // for validating weather the user is first time visit or not.
  isUserLoggingFirstTime: Boolean;

  constructor(private platform: Platform, private zone: NgZone, private facebook: Facebook, private router: Router, private angularFirestore: AngularFirestore, private loadingController: LoadingController) { 
    this.db = this.angularFirestore;
  }

  
// Create a Firestore reference


  init(): void {
   
    firebase.auth().onAuthStateChanged(async firebaseUser => {
      console.log(firebaseUser);
      
      this.zone.run(() => {
        firebaseUser ? this.loggedIn.next(true) : this.loggedIn.next(false);
      });
      const userStatus = localStorage.getItem('user');
      const isHelpItemsUpdated = localStorage.getItem('isHelpItemsUpdated');
      const manualLocationStatus = localStorage.getItem('manualLocation')
      const locationStatus = localStorage.getItem('location')
      if(firebaseUser !== null){
       
        this.navigateToHomePage();
      } else if(userStatus === null) {
        this.router.navigate(['']);
        
      } else if(isHelpItemsUpdated === null){
        this.router.navigate(['onboarding1']);
      } else if(manualLocationStatus === null && locationStatus === null){
        this.router.navigate(['onboarding2']);
      } else {
        this.router.navigate(['onboarding3']);
      }
    });
  }

  login(): void {
    if (this.platform.is("capacitor")) {
      this.nativeFacebookAuth();
    } else {
      this.browserFacebookAuth();
    }
  }

  async logout(): Promise<void> {
    console.log('logging out');
    if (this.platform.is("capacitor")) {
      try {
        console.log('logging out 1');
        await this.facebook.logout(); // Unauth with Facebook
        await firebase.auth().signOut(); // Unauth with Firebase
        localStorage.removeItem('userDetails');
        indexedDB.deleteDatabase('firebaseLocalStorageDb');
        this.router.navigate(['onboarding3']);
      } catch (err) {
        console.log(err);
      }
    } else {
      try {
        await firebase.auth().signOut();
        localStorage.removeItem('userDetails');
        indexedDB.deleteDatabase('firebaseLocalStorageDb');
        this.router.navigate(['onboarding3']);
      } catch (err) {
        console.log(err);
      }
    }
  }

  async nativeFacebookAuth(): Promise<void> {

    try {

      const response = await this.facebook.login(["public_profile", "email"]);

      
      if (response.authResponse) {
        // User is signed-in Facebook.
        const unsubscribe = firebase.auth().onAuthStateChanged(firebaseUser => {
          unsubscribe();
          // Check if we are already signed-in Firebase with the correct user.
          if (!this.isUserEqual(response.authResponse, firebaseUser)) {
            // Build Firebase credential with the Facebook auth token.
            const credential = firebase.auth.FacebookAuthProvider.credential(
              response.authResponse.accessToken
            );
            // Sign in with the credential from the Facebook user.
            firebase
              .auth()
              .signInWithCredential(credential).then((result)=>{
                console.log(result);
              })
              .catch(error => {
                console.log(error);
              });
          } else {
            // User is already signed-in Firebase with the correct user.
            console.log("already signed in");
            this.navigateToHomePage();
          }
        });
      } else {
        // User is signed-out of Facebook.
        firebase.auth().signOut();
      }

    } catch (err) {
      console.log(err);
    }

  }

  async browserFacebookAuth(): Promise<void> {
    const provider = new firebase.auth.FacebookAuthProvider();
    try {
      await firebase.auth().signInWithRedirect(provider);
    } catch (err) {
      console.log(err);

    }
  }

  // async onLoginUser(result: any){
    
    
  // }

  isUserEqual(facebookAuthResponse, firebaseUser): boolean {
    if (firebaseUser) {
      const providerData = firebaseUser.providerData;

      providerData.forEach(data => {
        if (
          data.providerId === firebase.auth.FacebookAuthProvider.PROVIDER_ID &&
          data.uid === facebookAuthResponse.userID
        ) {
          // We don't need to re-auth the Firebase connection.
          return true;
        }
      });
    }

    return false;
  }

  navigateToHomePage(){
    const userStatus = localStorage.getItem('user');
    console.log(userStatus);
    if(userStatus === 'volunteer'){
      this.router.navigate(['home/people']);
    } else if(userStatus === 'people'){
      this.router.navigate(['home/volunteer']);
    } else {
      this.router.navigate(['welcome']);
    }
  }

  //  async getAllDocuments(collection: string): Promise<any> {

  //     await this.db.collection(collection).ref.get()
  //       .then(snapshot => {
  //         var ListOfAllUsers: any = [];
  //         snapshot.forEach(doc => {
  //           console.log(doc.id, '=>', doc.data());
  //           ListOfAllUsers.push(doc.data());
  //         });
  //         this.allUsers = ListOfAllUsers;
          
  //       })
  //       .catch(err => {
  //         console.log('Error getting documents', err);
  //       });
  // }


  async getTheSpecificDocument(collection: string, userId: string){
    console.log('lets start')
    let theSpecificUser = await this.db.collection(collection).ref.where('userId', '==', userId).get()
          .then( snapshot => {
            if (snapshot.empty) {
              console.log('No matching documents.');
              this.isUserLoggingFirstTime = true;
            }  
        
            snapshot.forEach(doc => {
              console.log(doc.id, '=>', doc.data());
              localStorage.setItem('firebaseId', doc.id );
              localStorage.setItem('firebaseData', JSON.stringify(doc.data()));
              this.isUserLoggingFirstTime = false;
            });
          })
          .catch(err => {
            console.log('Error getting documents', err);
            return;
          });
    return theSpecificUser;
  }


  async addUserDataToFirebase(userType: string, userData: any){
 
            await this.db.collection(userType).add(userData)
            .then(ref => {
              console.log('Added document with ID: ', ref);
              localStorage.setItem('firebaseId', ref.id );
              localStorage.setItem('firebaseData', JSON.stringify(userData));
            })

            this.isUserLoggingFirstTime = true;
  }

  async mergeUserDataToFirebase(userType: string, docId: any, userData: any) {

            await this.db.collection(userType).doc(docId).set(userData,  {merge: true} ); 
  }

}
