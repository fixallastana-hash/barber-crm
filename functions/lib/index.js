"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSalon = exports.helloWorld = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
(0, v2_1.setGlobalOptions)({ region: 'asia-east1' });
exports.helloWorld = (0, https_1.onCall)(() => {
    return { message: 'Hello from Barber CRM Functions' };
});
exports.registerSalon = (0, https_1.onCall)(async (request) => {
    const data = request.data || {};
    const salonName = data.salonName;
    const email = data.email;
    const password = data.password;
    if (!salonName) {
        throw new https_1.HttpsError('invalid-argument', 'salonName is required');
    }
    if (!email) {
        throw new https_1.HttpsError('invalid-argument', 'email is required');
    }
    if (!password) {
        throw new https_1.HttpsError('invalid-argument', 'password is required');
    }
    let userRecord;
    try {
        userRecord = await auth.createUser({ email, password });
    }
    catch (err) {
        const error = err;
        if (error.code === 'auth/email-already-exists') {
            throw new https_1.HttpsError('already-exists', 'Email already registered');
        }
        throw new https_1.HttpsError('internal', error.message || 'Unknown error');
    }
    const uid = userRecord.uid;
    const tenantId = db.collection('tenants').doc().id;
    const batch = db.batch();
    const infoPath = 'tenants/' + tenantId + '/config/info';
    batch.set(db.doc(infoPath), {
        name: salonName,
        widgetSlug: '',
        city: '',
        timezone: 'Asia/Almaty',
        phone: '',
        cancellationWindowHours: 3,
        reminderHours: [3],
        noshowBlockThreshold: 3,
        requireConfirmation: false,
        pendingConfirmationTimeoutMinutes: 30,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _schemaVersion: 4,
    });
    const limitsPath = 'tenants/' + tenantId + '/config/billingLimits';
    batch.set(db.doc(limitsPath), {
        maxBranches: 1,
        maxMasters: 3,
        maxAppointmentsPerMonth: 500,
        messagesLimitThisMonth: 500,
        messagesUsedThisMonth: 0,
        isBlocked: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const userPath = 'tenants/' + tenantId + '/users/' + uid;
    batch.set(db.doc(userPath), {
        role: 'owner',
        name: '',
        phone: '',
        email: email,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    await auth.setCustomUserClaims(uid, { tenantId: tenantId, role: 'owner' });
    return { success: true, tenantId: tenantId, uid: uid };
});
//# sourceMappingURL=index.js.map